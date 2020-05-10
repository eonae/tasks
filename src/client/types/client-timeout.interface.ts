import { Milliseconds } from '../../shared';

export interface ClientTimeout { }

export interface NoTimeout extends ClientTimeout {
  unlimited: true;
}

export interface SpecificTimeout extends ClientTimeout {
  msec: Milliseconds;
}
