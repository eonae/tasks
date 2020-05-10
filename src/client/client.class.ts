import { DEFAULT_CLIENT_TIMEOUT, DEFAULT_CLIENT_POLLING_INTERVAL, DEFAULT_CACHE_TTL, DEFAULT_CACHE_MAX_AGE } from './constants';
import { PollingTimeoutException, CancelledException } from './exceptions';
import { Task, TaskStatus, TaskRepository, Priority, TaskNotFoundException, Milliseconds, TaskId, Seconds } from '../shared';
import { ClientConfig, TaskResult } from './types';
import { IDisposable } from '@skeleton/common';
import { ILogger } from '@skeleton/logger';
import { delay } from '@libs/common';
import _ from 'lodash';

export class Client<TInput, TOutput> implements IDisposable {

  private readonly repo: TaskRepository<TInput, TOutput>;
  private readonly timeout: Milliseconds;
  private readonly pollingInterval: Milliseconds;
  private readonly cacheMaxAge: Seconds;

  public constructor (
    private readonly logger: ILogger,
    private readonly inputCtor: new () => TInput,
    private readonly outputCtor: new () => TOutput,
    private readonly config: ClientConfig
  ) {
    this.repo = new TaskRepository<TInput, TOutput>(this.config.queue, logger);
    this.timeout = this.getTimeout();
    this.pollingInterval = this.getPollingInterval();
    this.cacheMaxAge = this.getCacheMaxAge();
  }

  private get allowCache () {
    return !!this.cacheMaxAge;
  }

  private get useTimeout () {
    return !!this.timeout;
  }

  private getCacheMaxAge (): Seconds | null {
    const allow = _.get(this, 'config.caching.allow');
    const max = _.get(this, 'config.caching.max');
    return max || (allow ? DEFAULT_CACHE_MAX_AGE : null);
  }

  private getTimeout (): Milliseconds | null {
    const msec = _.get(this, 'config.polling.timeout.msec')
    const unlimited = _.get(this, 'config.polling.timeout.unlimited');
    return msec || (unlimited ? null : DEFAULT_CLIENT_TIMEOUT);
  }

  private getPollingInterval (): Milliseconds {
    return _.get(this, 'config.polling.interval') || DEFAULT_CLIENT_POLLING_INTERVAL;
  } 

  private getDeadline (): number | null {
    return this.useTimeout
      ? (Date.now() + this.timeout)
      : null;
  }

  async createTask(input: TInput, priority?: Priority): Promise<TaskId> {
    if (this.allowCache) {
      const cachedTaskId = this.repo.checkCache(input, this.cacheMaxAge);
      if (cachedTaskId !== null) return cachedTaskId;
    }
    const task = Task.create<TInput, TOutput>(input);
    await this.repo.save(task);
    await this.repo.push(task, priority || Priority.low);
    return task.id;
  }

  async getTask(id: TaskId): Promise<TaskResult<TOutput>> {
    const task = await this.repo.get(id);
    return {
      status: task.status,
      output: task.output
    }
  }

  async awaitTask(input: TInput, priority?: Priority): Promise<TOutput> {
    return new Promise<TOutput>(async (resolve, reject) => {
      const id = await this.createTask(input, priority);

      const deadline = this.getDeadline();
      while(true) {
        try {
          this.logger.debug(`Polling delay ${this.pollingInterval} msec...`);
          await delay(this.pollingInterval);
          if (deadline && Date.now() > deadline) {
            // Should we really update task status here? to cancelled?
            return reject(new PollingTimeoutException(id, this.timeout));
          }
          
          this.logger.debug(`Quering task`);
          const task = await this.repo.get(id);
          if (!task) throw new TaskNotFoundException(id);
          this.logger.debug(`status: ${task.status}`);
          if (!task.isFinished) continue;
          this.logger.info('Task is done');
          console.log(task.output);
          switch (task.status) {
            case TaskStatus.done: return resolve(task.output.data);
            case TaskStatus.failed: return reject(task.output.error);
            case TaskStatus.canceled: return reject(new CancelledException(task.id));
          }
        } catch (error) {
          return reject(error);
        }

      }
    });
  }

  dispose(): Promise<void> {
    return this.repo.dispose();
  }
}