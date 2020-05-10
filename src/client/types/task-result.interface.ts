import { TaskStatus } from '../../shared';
import { Result } from '@skeleton/common';

export interface TaskResult<IOutput> {
  status: TaskStatus;
  output?: Result<IOutput>;
}
