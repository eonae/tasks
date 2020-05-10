import { DomainException } from '@skeleton/common';
import { TaskId } from '../types';

export class TaskNotFoundException extends DomainException {

  constructor (taskId: TaskId) {
    super(`Task id = ${taskId} not found in storage! Probably it's ttl expired.`);
  }
}