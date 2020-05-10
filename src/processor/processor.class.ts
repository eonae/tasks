import { TaskRepository, Task } from '../shared';
import { ILogger } from '@skeleton/logger';
import { ProcessorConfig } from './processor-config.interface';
import { AsyncResult, Result } from '@skeleton/common';
import { DEFAULT_PROCESSOR_POLLING_INTERVAL, DEFAULT_PREFETCH } from './constants';
import { delay } from '@libs/common';
import _ from 'lodash';

export abstract class Processor<TInput, TOutput> {
  
  private readonly repo: TaskRepository<TInput, TOutput>;
  private activeTasks: Array<AsyncResult<TOutput>>;

  public constructor (
    private readonly logger: ILogger,
    private readonly inputCtor: new () => TInput,
    private readonly outputCtor: new () => TOutput,
    private readonly config: ProcessorConfig
  )  {
    this.repo = new TaskRepository<TInput, TOutput>(this.config.queue, logger);
    this.activeTasks = [];
    console.log('activeTasks', this.activeTasks.length);
  }

  protected abstract process (input: TInput): AsyncResult<TOutput>

  private async setInProcess (
    task: Task<TInput, TOutput>
  ) {
    task.setInProgress();
    const response = await this.repo.save(task);
    this.logger.info(`Task id = ${task.id} set status: IN_PROGRESS`);
  }

  private async setDone (
    task: Task<TInput, TOutput>,
    result: Result<TOutput>,
    resolve: Function
  ) {
    this.logger.debug('Setting to done.');
    task.setDone(result.data);
    const r = await this.repo.save(task);
    this.logger.debug(`Task id = ${task.id} set status: DONE`);
    resolve(result);
  }

  private async setFailed (
    task: Task<TInput, TOutput>,
    result: Result<TOutput>,
    resolve: Function
  ) {
    this.logger.info('Moving to failed.');
    task.setFailed(result.error);
    const r = await this.repo.save(task);
    this.logger.debug('Moved to failed.');
    resolve(result);
  }

  public async run (): Promise<void> {
    
    console.log(this.activeTasks.length);
    this.logger.info(`Worker pid = ${process.pid} started...`);
    const interval = _.get(this, 'config.polling.interval')
                  || DEFAULT_PROCESSOR_POLLING_INTERVAL;
    const prefetch = this.config.prefetch || DEFAULT_PREFETCH;
    while (true) {
      await delay(interval);
      this.logger.debug(`Prefetch: ${prefetch}`);
      this.logger.debug(`Active tasks count: ${this.activeTasks.length}`);
      if (this.activeTasks.length >= prefetch) {
        this.logger.info(`Worker pid = ${process.pid} is busy (prefetch = ${prefetch})`);
        continue;
      }
      this.logger.debug(`Polling delay ${interval} msec...`);
      const taskId = await this.repo.pop();
      if (!taskId) {
        this.logger.debug('No task.');
        continue;
      }
      const task = await this.repo.get(taskId);
      if (!task || task.isFinished) {
        console.log('Skipping');
        continue;
      }
      await this.setInProcess(task);

      // Validate
      const promise = new Promise<Result<TOutput>>(async resolve => {
        try {
          let result: Result<TOutput>;
          try {
            result = await this.process(task.input);
          } catch (error) {
            await this.setFailed(task, Result.error(error), resolve);
          }
          this.logger.debug(result);
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
    }
  }
}