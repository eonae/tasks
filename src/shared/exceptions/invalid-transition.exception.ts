import { DomainException } from '@skeleton/common';
import { TaskStatus } from '../types';

export class InvalidTransitionException extends DomainException {

  constructor(from: TaskStatus, to: TaskStatus) {
    super(`Can't change status from ${TaskStatus[from]} to ${TaskStatus[to]}.`);
  }
}
