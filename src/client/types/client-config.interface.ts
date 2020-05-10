import { TaskQueueConfig } from '../../shared';
import { ClientPollingConfig } from './client-polling-config';
import { ClientCachingConfig } from './client-caching-config';

export interface ClientConfig {
  queue: TaskQueueConfig;
  polling?: ClientPollingConfig;
  caching?: ClientCachingConfig;
}
