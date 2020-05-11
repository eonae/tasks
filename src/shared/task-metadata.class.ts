import { ErrorLike } from '@skeleton/common';
import { enumValues } from '@libs/common';
import { TaskStatus, TaskId } from './types';
import {
  IsString,
  IsInt,
  IsPositive,
  IsOptional,
  IsNotEmpty,
  IsObject,
  IsIn 
} from 'class-validator';

export class TaskMetadata {

  @IsString()
  @IsNotEmpty()
  id: TaskId;

  @IsInt()
  @IsPositive()
  createdAt: number;

  @IsInt()
  @IsPositive()
  @IsOptional()
  updatedAt: number;

  @IsInt()
  @IsPositive()
  @IsOptional()
  takenAt: number;

  @IsString()
  // CHECKME: Or enumKeys?
  @IsIn(enumValues(TaskStatus))
  status: TaskStatus;

  @IsObject()
  @IsOptional()
  error?: ErrorLike;
}
