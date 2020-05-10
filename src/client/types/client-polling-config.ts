import { SpecificTimeout, NoTimeout } from './client-timeout.interface';
import { Milliseconds } from 'src/shared';

export interface ClientPollingConfig {
  timeout?: SpecificTimeout | NoTimeout;
  interval?: Milliseconds;
}
