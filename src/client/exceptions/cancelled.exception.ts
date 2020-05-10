import { DomainException } from '@skeleton/common';
import { TaskId } from '../../shared';

export class CancelledException extends DomainException {

  constructor(taskId: TaskId) {
    super(`Task id = ${taskId} was cancelled!`);
  }
}
