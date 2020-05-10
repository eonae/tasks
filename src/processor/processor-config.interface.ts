import { TaskQueueConfig } from '../shared';
import { ProcessorPollingConfig } from './processor-polling-config.interface';
import { ProcessorCachingConfig } from './processor-caching-config';

export interface ProcessorConfig {
  queue: TaskQueueConfig;
  polling?: ProcessorPollingConfig;
  caching?: ProcessorCachingConfig; 
  prefetch?: number;
}
