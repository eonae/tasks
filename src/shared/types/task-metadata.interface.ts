import { ErrorLike } from '@skeleton/common';
import { TaskStatus } from './task-status.enum';

export interface TaskMetadata {
  id: string;
  createdAt: number;
  updatedAt: number;
  takenAt: number;
  status: TaskStatus;
  error?: ErrorLike;
}
