import { SpecificTimeout, NoTimeout } from './client-timeout.interface';
import { Milliseconds } from '../../shared';

export interface ClientPollingConfig {
  timeout?: SpecificTimeout | NoTimeout;
  interval?: Milliseconds;
}
