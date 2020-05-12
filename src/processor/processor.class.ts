import { TaskRepository, Task, Milliseconds, Seconds } from '../shared';
import { ILogger } from '@skeleton/logger';
import { ProcessorConfig } from './types/processor-config.interface';
import { AsyncResult, Result } from '@skeleton/common';
import { DEFAULT_PROCESSOR_POLLING_INTERVAL, DEFAULT_PREFETCH, DEFAULT_CACHE_TTL } from './constants';
import { delay } from '@libs/common';
import { plainToClass } from 'class-transformer';
import _ from 'lodash';
import { validate } from 'class-validator';
import { InputValidationException } from './exceptions';

export abstract class Processor<TInput, TOutput> {
  
  private readonly repo: TaskRepository<TInput, TOutput>;
  private activeTasks: Array<AsyncResult<TOutput>>;
  private cacheTTL: Seconds;

  public constructor (
    private readonly inputCtor: new () => TInput,
    private readonly logger: ILogger,
    private readonly config: ProcessorConfig
  )  {
    this.repo = new TaskRepository<TInput, TOutput>(this.config.queue, logger);
    this.activeTasks = [];
    this.cacheTTL = this.getCacheTTL();
  }

  private getCacheTTL (): Seconds | null {
    const useCache = _.get(this, 'config.caching.useCache');
    const ttl = _.get(this, 'config.caching.ttl');
    return ttl || (useCache ? DEFAULT_CACHE_TTL : null);
  }

  private get useCache (): boolean {
    return !!this.cacheTTL;
  }

  protected abstract process (input: TInput): AsyncResult<TOutput>

  private async setInProcess (
    task: Task<TInput, TOutput>
  ) {
    task.setInProgress();
    await this.repo.save(task);
    this.logger.debug(`Task id = ${task.id} set status: IN_PROGRESS`);
  }

  private async setDone (
    task: Task<TInput, TOutput>,
    result: Result<TOutput>,
    resolve: Function
  ) {
    task.setDone(result.data);
    await this.repo.save(task);
    this.logger.debug(`Task id = ${task.id} set status: DONE`);
    if (this.useCache) {
      await this.repo.createCacheReference(task, this.cacheTTL);
    }
    this.logger.debug({ 'Process successfull': result.data });
    resolve(result);
  }

  private async setFailed (
    task: Task<TInput, TOutput>,
    result: Result<TOutput>,
    resolve: Function
  ) {
    task.setFailed(result.error);
    await this.repo.save(task);
    this.logger.debug(`Task id = ${task.id} set status: FAILED`);
    resolve(result);
  }

  public async run (): Promise<void> {
    
    this.logger.info(`Worker pid = ${process.pid} started...`);
    const interval =
      _.get(this, 'config.polling.interval') || DEFAULT_PROCESSOR_POLLING_INTERVAL;
    const prefetch = this.config.prefetch || DEFAULT_PREFETCH;
    while (true) {
      try {
        this.logger.debug(`Polling delay ${interval} msec...`);
        await delay(interval);
        this.logger.debug(`Active tasks: ${this.activeTasks.length}/${prefetch}`);
        if (this.activeTasks.length >= prefetch) {
          this.logger.warn(`Worker pid = ${process.pid} is busy.`);
          continue;
        }
        const taskId = await this.repo.pop();
        if (!taskId) {
          this.logger.debug('No task.');
          continue;
        }
        const task = await this.repo.get(taskId);
        if (!task || task.isFinished) {
          this.logger.warn(`Couldn't find data for task id = ${taskId}. Probably it's ttl expired. Skipping...`);
          continue;
        }
        await this.setInProcess(task);
  
        const promise = new Promise<Result<TOutput>>(async resolve => {
          // TODO: Вынести в отдельный метод (или класс?);
          // CHECKME: не будет ли здесь проблем из-за замыкания?
          const input = plainToClass(this.inputCtor, task.input);
          const errors = await validate(input);
          if (errors.length > 0) {
            const exception = new InputValidationException(task.id, errors);
            this.logger.error(exception);
            this.setFailed(task, Result.error(exception), resolve);
          }
          try {
            let result: Result<TOutput>;
            try {
              result = await this.process(task.input);
            } catch (error) {
              await this.setFailed(task, Result.error(error), resolve);
            }
            if (result.isError) {
              await this.setFailed(task, result, resolve);
            } else {
              await this.setDone(task, result, resolve);
            }
          } catch (error) {
            resolve(Result.error(error));
          } finally {
            this.activeTasks = this.activeTasks.filter(p => p !== promise);
          }      
        });
        this.activeTasks.push(promise);        
      } catch (error) {
        this.logger.error(error);
      }
    }
  }
}