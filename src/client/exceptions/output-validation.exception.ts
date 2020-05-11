import { DomainException } from '@skeleton/common';
import { ValidationError } from 'class-validator';
import { TaskId } from '../../shared';

export class OutputValidationException extends DomainException {

  constructor(taskId: TaskId, errors: ValidationError[]) {
    super(`Output validation for task id = ${taskId} failed!`, errors);
  }
}
