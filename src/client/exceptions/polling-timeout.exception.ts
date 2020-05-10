import { DomainException } from '@skeleton/common';

export class PollingTimeoutException extends DomainException {

  constructor(taskId: string, timeout: number) {
    super(`Awaiting of task id = ${taskId} failed due timeout (${timeout} msec)`);
  }
}
