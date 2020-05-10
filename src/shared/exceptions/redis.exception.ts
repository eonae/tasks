import { DomainException, ErrorLike } from '@skeleton/common';

export class RedisException extends DomainException {

  constructor(msg: string)
  constructor(inner: ErrorLike)
  constructor(msg: string, inner: ErrorLike)
  constructor(msgOrErr: string | ErrorLike, inner?: ErrorLike) {
    if (typeof msgOrErr === 'string') {
      super('REDIS ERROR: ' + msgOrErr, inner);
    } else {
      msgOrErr.message = 'REDIS ERROR: ' + msgOrErr.message;
      super(msgOrErr);
    }
  }
}
