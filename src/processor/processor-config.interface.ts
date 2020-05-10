import { TaskQueueConfig } from '../shared';
import { ProcessorPollingConfig } from './processor-polling-config.interface';

export interface ProcessorConfig {
  queue: TaskQueueConfig;
  polling?: ProcessorPollingConfig;
  prefetch?: number;
}
