import { DomainException } from '@skeleton/common';

export class TaskNotFoundException extends DomainException {

  constructor (taskId: string) {
    super(`Task id = ${taskId} not found in storage! Probably it's expired`);
  }
}