import { IDisposable, Result } from '@skeleton/common';
import { ILogger } from '@skeleton/logger';
import { DEFAULT_TTL } from './constants';
import { TaskQueueConfig, TaskMetadata } from './types';
import { Task } from './task.class';
import Redis from 'ioredis';
import { Priority } from './types';
import { TaskNotFoundException } from './exceptions';

export class TaskRepository<TInput, TOutput> implements IDisposable {

  private redis: Redis.Redis;
  private getDataKey: (taskId: string) => string;
  private getQueueKey: (priority: Priority) => string;

  constructor (
    private queue: TaskQueueConfig,
    private logger: ILogger
  ) {
    const { name, connection } = this.queue;
    this.redis = new Redis(connection);
    this.getDataKey = (taskId: string) => `${name}:data:${taskId}`;
    this.getQueueKey = (priority: Priority) => `${name}:queue:${priority}`;
  }

  private async hget<T>(dataKey: string, key: string): Promise<T> {
    const str = await this.redis.hget(dataKey, key);
    return JSON.parse(str) as T;
  }

  public async get(id: string): Promise<Task<TInput, TOutput>> {
  
    const dataKey = this.getDataKey(id);
    const meta = await this.hget<TaskMetadata>(dataKey, 'metadata');
    if (!meta) return null;
    const input = await this.hget<TInput>(dataKey, 'input');
    const output = await this.hget<Result<TOutput>>(dataKey, 'output');

    return Task.parse(meta, input, output);
  }

  public async push (
    task: Task<TInput, TOutput>,
    priority: Priority
  ): Promise<void> {
    const queueKey = this.getQueueKey(priority);
    const result = await this.redis.lpush(queueKey, task.id);
    console.log(result); // FIXME
    this.logger.info('Task pushed to queue.');
  }

  public async pop (): Promise<string> {
    const queues = Object.values(Priority)
      .filter(key => typeof key === 'number')
      .map(p => this.getQueueKey(p as Priority));
    for (let queue of queues) {
      const taskId = await this.redis.rpop(queue);
      this.logger.debug(`Checked queue ${queue}. Got ${taskId}`);
      if (taskId !== null) return taskId;        
    }
    return null;
  }

  public async cache (task: Task<TInput, TOutput>): Promise<any> {

  }



  /////////
  /*
    Размышления о кешировании.
    В кеше появляются результаты, когда процессор успешно заканчивает задачу - остальное сложно.
    Поэтому по идее настройка кеширования должна быть и в клиенте и в процессоре.
    В клиенте - хочет ли клиент ходить в кеш (и какая свежесть кеша его устраивает),
    а в процессоре - доступно ли кеширование вообще для данного вида работ.

    Может быть определённая "некрасивость" в том, что клиент скажет - да, хочу кеш, а воркер этот кеш не
    поддерживает.

    Кроме кеширования осталась ещё валидация!!!
    И логи подправить.ы
  */

  public async save (task: Task<TInput, TOutput>): Promise<Task<TInput, TOutput>> {
    // We need to save this because it'll be changed during updateTimestamps();
    const isNew = task.isNew;
    this.logger.debug(`Saving task isNew = ${task.isNew}`);
    const dataKey = this.getDataKey(task.id);
    task.updateTimestamps();
    const rData = await this.redis.multi()
      .hset(dataKey, 'input', JSON.stringify(task.input))
      .hset(dataKey, 'output', JSON.stringify(task.output))
      .hset(dataKey, 'metadata', JSON.stringify(task.metadata))
      .exec();
    this.logger.debug('Task data saved.');
    console.log('save result:', rData); // FIXME: debug;
    // We need to use the flag saved before
    if (isNew) {
      const ttl = this.queue.ttl || DEFAULT_TTL;
      this.redis.expire(dataKey, ttl);
      this.logger.debug(`TTL is set to ${ttl} seconds.`);
    }
    this.logger.info(`Task id = ${task.id} saved!`);
    return task;
  }

  dispose(): Promise<void> {
    return new Promise(resolve => {
      this.redis.on('close', () => {
        this.logger.info('Redis client dispose');
        resolve();
      });
      this.redis.disconnect();
    })
  }
}
