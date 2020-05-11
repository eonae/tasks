import { DomainException } from '@skeleton/common';
import { ValidationError } from 'class-validator';
import { TaskId } from '../../shared';

export class InputValidationException extends DomainException {

  constructor(taskId: TaskId, errors: ValidationError[]) {
    super(`Input validation for task id = ${taskId} failed!`, errors);
  }
}
