import { ErrorLike } from '@skeleton/common';
import { TaskStatus } from './task-status.enum';
import { TaskId } from './task-id.type';

export interface TaskMetadata {
  id: TaskId;
  createdAt: number;
  updatedAt: number;
  takenAt: number;
  status: TaskStatus;
  error?: ErrorLike;
}
