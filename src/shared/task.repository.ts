
import { IDisposable, Result } from '@skeleton/common';
import { validate } from 'class-validator';
import { ILogger } from '@skeleton/logger';
import { enumValues } from '@libs/common';
import Redis from 'ioredis';
import md5 from 'md5';

import { TaskQueueConfig, TaskId, Seconds } from './types';
import { InvalidMetadataException } from './exceptions';
import { TaskMetadata } from './task-metadata.class';
import { plainToClass } from 'class-transformer';
import { DEFAULT_TTL } from './constants';
import { Task } from './task.class';
import { Priority } from './types';

export class TaskRepository<TInput, TOutput> implements IDisposable {

  private redis: Redis.Redis;
  private getQueueKey: (priority: Priority) => string;
  private getDataKey: (taskId: TaskId) => string;
  private getCacheKey: (inputHash: string) => string;

  constructor (
    private queue: TaskQueueConfig,
    private logger: ILogger
  ) {
    const { name, connection } = this.queue;
    this.redis = new Redis(connection);
    this.getDataKey = (taskId: TaskId) => `${name}:data:${taskId}`;
    this.getQueueKey = (priority: Priority) => `${name}:queue:${priority}`;
    this.getCacheKey = (inputHash: string) => `${name}:cache:${inputHash}`;
  }

  private async hgetAndParse<T>(dataKey: string, key: string): Promise<T> {
    const str = await this.redis.hget(dataKey, key);
    return JSON.parse(str) as T;
  }

  public async get(id: TaskId): Promise<Task<TInput, TOutput>> {
  
    const dataKey = this.getDataKey(id);
    const rawMetadata = await this.hgetAndParse<any>(dataKey, 'metadata');

    if (!rawMetadata) return null;
    const metadata = plainToClass(TaskMetadata, rawMetadata);
    const errors = await validate(metadata);
    if (errors.length > 0) {
      throw new InvalidMetadataException(id, errors);
    }
    const input = await this.hgetAndParse<TInput>(dataKey, 'input');
    const output = await this.hgetAndParse<Result<TOutput>>(dataKey, 'output');

    return Task.parse(metadata, input, output);
  }

  public async push (
    task: Task<TInput, TOutput>,
    priority: Priority
  ): Promise<void> {
    const queueKey = this.getQueueKey(priority);
    await this.redis.lpush(queueKey, task.id);
    this.logger.debug('Task pushed to queue.');
  }

  public async pop (): Promise<TaskId> {
    const queues = enumValues(Priority)
      .map(p => this.getQueueKey(p as Priority));
    for (let queue of queues) {
      const taskId = await this.redis.rpop(queue);
      this.logger.debug(`Checking queue ${queue}...`);
      if (taskId !== null) {
        this.logger.debug(`Popped new task id = ${taskId}`);
        return taskId;
      }
    }
    return null;
  }

  public async createCacheReference (task: Task<TInput, TOutput>, ttl: number): Promise<void> {

    const inputHash = await this.getInputHash(task.input);
    const cacheKey = this.getCacheKey(inputHash);
    this.logger.debug(`Input hash: ${inputHash}`);
    try {
      await this.redis.multi()
        .set(cacheKey, task.id)
        .expire(cacheKey, ttl)
        .exec();
      this.logger.debug(`New cache link created ${inputHash}:${task.id} ttl = ${ttl}`);
    } catch (error) {
      this.logger.error(`Unable to create cache reference for ${inputHash}.`);
      this.logger.error(error);
    }
  }

  public async checkCache (input: TInput, max: Seconds): Promise<TaskId> {
    const inputHash = await this.getInputHash(input);
    const cacheKey = this.getCacheKey(inputHash);
    this.logger.debug(`Input hash: ${inputHash}`);
    const taskId = await this.redis.get(cacheKey);
    if (!taskId) {
      this.logger.debug(`Cache reference for ${inputHash} not found!`);
      return null;
    }
    this.logger.debug(`Cache reference found: ${inputHash}:${taskId}`);
    // What if expired!
    const dataKey = this.getDataKey(taskId);
    const unparsedMetadata = await this.redis.hget(dataKey, 'metadata');
    if (!unparsedMetadata) {
      this.logger.debug(`Task id = ${taskId} not found in storage! Probably it's ttl expired.`);
      return null;
    }
    try {
      const metadata = JSON.parse(unparsedMetadata);
      if (metadata.updatedAt < Date.now() - max * 1000) {
        this.logger.debug(`Cache age for ${inputHash} exceeds maximum specified by client.`);
        return null;
      }
    } catch (error) {
      this.logger.error(`Task id = ${taskId} error parsing metadata!`);
      return null;
    }
    // This stage is needed only to handle md5 collisions.
    // But it locks very slow and CPU-bound...
    const cachedInput = await this.redis.hget(dataKey, 'input');
    if (!cachedInput) {
      this.logger.debug(`Task id = ${taskId} not found in storage! Probably it's ttl expired.`);
      return null;
    }
    if (JSON.stringify(input) !== cachedInput) {
      this.logger.debug(`Cache for ${inputHash} can't be used. Probably hashing collision.`);
      return null;
    }
    this.logger.info(`Found cache for ${inputHash}`)
    return taskId;
  }

  public async save (task: Task<TInput, TOutput>): Promise<Task<TInput, TOutput>> {
    // We need to save this because it'll be changed during updateTimestamps();
    const isNew = task.isNew;
    this.logger.debug(`Saving task isNew = ${task.isNew}`);
    const dataKey = this.getDataKey(task.id);
    task.updateTimestamps();
    await this.redis.multi()
      .hset(dataKey, 'input', JSON.stringify(task.input))
      .hset(dataKey, 'output', JSON.stringify(task.output))
      .hset(dataKey, 'metadata', JSON.stringify(task.metadata))
      .exec();
    this.logger.debug('Task data saved.');
    // We need to use the flag saved before
    if (isNew) {
      const ttl = this.queue.ttl || DEFAULT_TTL;
      this.redis.expire(dataKey, ttl);
      this.logger.debug(`TTL is set to ${ttl} seconds.`);
    }
    this.logger.info(`Task id = ${task.id} saved!`);
    return task;
  }

  public dispose(): Promise<void> {
    return new Promise(resolve => {
      this.redis.on('close', () => {
        this.logger.info('Redis client is disposed.');
        resolve();
      });
      this.redis.disconnect();
    })
  }

  private getInputHash (input: TInput): Promise<string> {
    return Promise.resolve(md5(JSON.stringify(input)));
  }
}
