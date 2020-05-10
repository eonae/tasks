import { DomainException } from '@skeleton/common';
import { TaskId } from '../../shared';

export class PollingTimeoutException extends DomainException {

  constructor(taskId: TaskId, timeout: number) {
    super(`Awaiting of task id = ${taskId} failed due timeout (${timeout} msec)`);
  }
}
