import { Seconds } from '../../shared';

export interface ProcessorCachingConfig {
  useCache: true,
  ttl?: Seconds
}