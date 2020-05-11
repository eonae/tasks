import { DEFAULT_CLIENT_TIMEOUT, DEFAULT_CLIENT_POLLING_INTERVAL, DEFAULT_CACHE_TTL, DEFAULT_CACHE_MAX_AGE } from './constants';
import { PollingTimeoutException, CancelledException, OutputValidationException } from './exceptions';
import { Task, TaskStatus, TaskRepository, Priority, TaskNotFoundException, Milliseconds, TaskId, Seconds } from '../shared';
import { ClientConfig, TaskResult } from './types';
import { IDisposable } from '@skeleton/common';
import { ILogger } from '@skeleton/logger';
import { delay } from '@libs/common';
import _ from 'lodash';
import { validate, ValidationError } from 'class-validator';
import { plainToClass } from 'class-transformer';

export class Client<TInput, TOutput> implements IDisposable {

  private readonly repo: TaskRepository<TInput, TOutput>;
  private readonly timeout: Milliseconds;
  private readonly pollingInterval: Milliseconds;
  private readonly cacheMaxAge: Seconds;

  public constructor (
    private readonly outputCtor: new () => TOutput,
    private readonly logger: ILogger,
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
      this.logger.debug('Checking cache...');
      const cachedTaskId = await this.repo.checkCache(input, this.cacheMaxAge);
      if (cachedTaskId !== null) return cachedTaskId;
    }
    this.logger.debug('Creating new task');
    const task = Task.create<TInput, TOutput>(input);
    await this.repo.save(task);
    await this.repo.push(task, priority || Priority.low);
    return task.id;
  }

  async getTask(id: TaskId): Promise<TaskResult<TOutput>> {
    const task = await this.repo.get(id);
    // TODO: Error handling and validation;
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
          this.logger.debug(`Quering task id = ${id}...`);
          const task = await this.repo.get(id);
          if (!task) throw new TaskNotFoundException(id);
          this.logger.debug(`status: ${task.status}`);
          if (!task.isFinished) continue;
          this.logger.info('Task is done.');
          switch (task.status) {
            case TaskStatus.done: {
              const output = plainToClass(this.outputCtor, task.output.data);
              const errors = await validate(output);
              if (errors.length > 0) {
                const exception = new OutputValidationException(task.id, errors);
                this.logger.error(exception);
                reject(exception);
                return;
              } else {
                resolve(output);
                return;
              }
            }
            case TaskStatus.failed:
              reject(task.output.error);
              return;
            case TaskStatus.canceled: 
              reject(new CancelledException(task.id));
              return;
          }
        } catch (error) {
          reject(error);
        }
      }
    });
  }

  dispose(): Promise<void> {
    return this.repo.dispose();
  }
}