import { DomainException } from '@skeleton/common';

export class CancelledException extends DomainException {

  constructor(taskId: string) {
    super(`Task id = ${taskId} was cancelled!`);
  }
}
