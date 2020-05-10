import { Seconds } from '../../shared';

export interface ClientCachingConfig {
  allow: true,
  max?: Seconds
}