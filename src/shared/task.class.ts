import { InvalidTransitionException } from './exceptions';
import { TaskMetadata, TaskStatus } from './types';
import { ErrorLike, Result } from '@skeleton/common';
import { v4 } from 'uuid';

export class Task<TInput, TOutput> {

  private _id: string;
  private _createdAt: number;
  private _updatedAt: number;
  private _takenAt: number;
  private _status: TaskStatus;
  private _input: TInput;
  private _output?: Result<TOutput>;

  public get metadata (): TaskMetadata {
    return {
      id: this._id,
      createdAt: this._createdAt,
      takenAt: this._takenAt,
      updatedAt: this._updatedAt,
      status: this._status
    }
  }
  public get id (): string { return this._id }
  public get status (): TaskStatus { return this._status }
  public get isNew (): boolean { return !this._createdAt }
  public get input (): TInput { return this._input }
  public get output (): Result<TOutput> { return this._output }
  public get isFinished (): boolean {
    return this._status === TaskStatus.done
        || this._status === TaskStatus.canceled
        || this._status === TaskStatus.failed
  }

  private constructor () {}

  public canChangeTo(to: TaskStatus): boolean {
    const transitions = new Map<TaskStatus, TaskStatus[]>()
      .set(TaskStatus.waiting, [
        TaskStatus.inProgress,
        TaskStatus.canceled
      ])
      .set(TaskStatus.inProgress, [
        TaskStatus.done,
        TaskStatus.failed,
        TaskStatus.canceled
      ])
      .set(TaskStatus.canceled, [])
      .set(TaskStatus.failed, [])
      .set(TaskStatus.done, []);
      
    return transitions.get(this._status).includes(to);
  }

  private _setStatus (newStatus: TaskStatus): void {
    if (this.canChangeTo(newStatus)) {
      this._status = newStatus;
    } else {
      throw new InvalidTransitionException(this._status, newStatus);
    }
  }

  public setDone(output: TOutput): void {
    this._setStatus(TaskStatus.done);
    this._output = Result.data(output);
  }

  public setFailed(error: ErrorLike) {
    this._setStatus(TaskStatus.failed);
    this._output = Result.error(error);
  }

  public setInProgress(): void {
    this._setStatus(TaskStatus.inProgress);
    this._takenAt = Date.now();
  }

  public updateTimestamps() {
    if (this.isNew) {
      this._createdAt = Date.now();
    } else {
      this._updatedAt = Date.now();
    }
  }

  static async parse<TInput, TOutput>(
    meta: TaskMetadata,
    input: TInput,
    output: Result<TOutput>
  ): Promise<Task<TInput, TOutput>> {
    const task = new Task<TInput, TOutput>();
    task._id = meta.id;
    task._createdAt = meta.createdAt;
    task._updatedAt = meta.updatedAt;
    task._takenAt = meta.takenAt;
    task._status = meta.status;
    task._input = input;
    task._output = output;
    // Validate?
    return task;
  }

  static create<TInput, TOutput>(input: TInput): Task<TInput, TOutput> {
    const task = new Task<TInput, TOutput>();
    task._id = v4();
    task._status = TaskStatus.waiting;
    task._createdAt = null;
    task._updatedAt = null;
    task._input = input;
    task._output = null;
    return task;
  }
}
