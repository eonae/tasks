import { Logger, LogFormat } from '@skeleton/logger';
import { Client, ClientConfig } from '../client';
import { TestOutput, TestInput } from './dto';
import { Priority } from '../shared';

const logger = new Logger({
  level: 'debug',
  formatter: LogFormat.friendly
}, 'CLIENT');

const main = async () => {

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

  const client = new Client<TestInput, TestOutput>(TestOutput, logger, config);

  const input = new TestInput();
  input.template = '<div></div>';
  input.data = {};
  input.format = 'xlsx';


  try {
    if (process.argv[2] === 'push') {
      const n = process.argv[3] ? +process.argv[3] : 1;
      for (let i = 0; i < n; i++) {
        const taskId = await client.createTask(input);
        logger.info(taskId);
      }
    } else if (process.argv[2] === 'await') {
      const taskResult = await client.awaitTask(input, Priority.medium);
      logger.info(taskResult);
    }
  } catch (error) {
    logger.error(error);
  }

  await client.dispose();
}

// main();

/*
Need to test:
  - redis is unreachable on startup
  - redis is out when connection exists
*/