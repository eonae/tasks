export interface TaskQueueConfig {
  name: string;
  connection: string;
  ttl?: number;
}