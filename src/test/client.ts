import { Logger, LogFormat } from '@skeleton/logger';
import { Client, ClientConfig } from '../client';
import { TestOutput, TestInput } from './dto';
import { Priority } from '../shared';

const main = async () => {

  const logger = new Logger({
    level: 'debug',
    formatter: LogFormat.friendly
  }, 'CLIENT');

  const config: ClientConfig = {
    queue: {
      name: 'test',
      connection: 'redis://localhost:6380',
      // ttl: 60 // seconds
    },
    polling: {
      timeout: {
        unlimited: true
      },
      interval: 1000
    },
    caching: {
      allow: true,
      // max: 10
    }
    // polling: {
    //   timeout: {
    //     msec: 2000
    //   },
    //   // interval: 300
    // }
  };

  const client = new Client<TestInput, TestOutput>(logger, TestInput, TestOutput, config);

  try {
    if (process.argv[2] === 'push') {
      const n = process.argv[3] ? +process.argv[3] : 1;
      for (let i = 0; i < n; i++) {
        const taskId = await client.createTask(new TestInput());
      }
    } else if (process.argv[2] === 'await') {
      const taskResult = await client.awaitTask(new TestInput(), Priority.medium);
    }
  } catch (error) {
    logger.error(error);
  }

  await client.dispose();
}

main();

/*
Need to test:
  - redis is unreachable on startup
  - redis is out when connection exists
*/