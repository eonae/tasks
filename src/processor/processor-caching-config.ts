import { Seconds } from '../shared';

export interface ProcessorCachingConfig {
  cacheResults: true,
  ttl?: Seconds
}