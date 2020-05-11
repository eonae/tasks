import { DomainException } from '@skeleton/common';
import { TaskId } from '../types';
import { ValidationError } from 'class-validator';

export class InvalidMetadataException extends DomainException {

  constructor(taskId: TaskId, errors: ValidationError[]) {
    super(`Metadata for taskId = ${taskId} is corrupted!`, errors);
  }
}
