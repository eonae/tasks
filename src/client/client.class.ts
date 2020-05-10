import { DEFAULT_CLIENT_TIMEOUT, DEFAULT_CLIENT_POLLING_INTERVAL, DEFAULT_CACHE_TTL } from './constants';
import { PollingTimeoutException, CancelledException } from './exceptions';
import { Task, TaskStatus, TaskRepository, Priority, TaskNotFoundException, Milliseconds } from '../shared';
import { ClientConfig, TaskResult } from './types';
import { IDisposable } from '@skeleton/common';
import { ILogger } from '@skeleton/logger';
import { delay } from '@libs/common';
import _ from 'lodash';

export class Client<TInput, TOutput> implements IDisposable {

  private readonly repo: TaskRepository<TInput, TOutput>;
  private readonly timeout: Milliseconds;
  private readonly pollingInterval: Milliseconds;
  private readonly cacheTTL: Milliseconds;

  public constructor (
    private readonly logger: ILogger,
    private readonly inputCtor: new () => TInput,
    private readonly outputCtor: new () => TOutput,
    private readonly config: ClientConfig
  ) {
    this.repo = new TaskRepository<TInput, TOutput>(this.config.queue, logger);
    this.timeout = this.getTimeout();
    this.pollingInterval = this.getPollingInterval();
    this.cacheTTL = this.getCacheTTL();
  }

  private getCacheTTL (): Milliseconds | null {
    
    const useCache = _.get(this, 'this.config.caching.useCaching');
    const ttl = _.get(this, 'this.config.caching.ttl');
    return ttl || (useCache ? DEFAULT_CACHE_TTL : null);
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
    return this.timeout ? (Date.now() + this.timeout) : null;
  }

  async createTask(input: TInput, priority?: Priority): Promise<string> {
    const task = Task.create<TInput, TOutput>(input);
    await this.repo.save(task);
    await this.repo.push(task, priority || Priority.low);
    return task.id;
  }

  async getTask(id: string): Promise<TaskResult<TOutput>> {
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