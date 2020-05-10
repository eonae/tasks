import { TestInput, TestOutput } from './dto';
import { AsyncResult, Result } from '@skeleton/common';
import { Processor, ProcessorConfig } from '../processor';
import { ILogger, Logger, LogFormat } from '@skeleton/logger';
import { delay } from '@libs/common';

export class ProcessorImplementation extends Processor<TestInput, TestOutput> {
  
  constructor (logger: ILogger, config: ProcessorConfig) {
    super(logger, TestInput, TestOutput, config);
  }

  protected async process (input: TestInput): AsyncResult<TestOutput> {
    const output = new TestOutput();
    output.fileUrl = 'some string';
    await delay(10000);
    return Result.data(output);
  }
}

const main = async () => {
  const logger = new Logger({
    level: 'debug',
    formatter: LogFormat.friendly
  }, 'PROCESSOR');

  const config: ProcessorConfig = {
    queue: {
      name: 'test',
      connection: 'redis://localhost:6380'
    },
    polling: {
      interval: 1000
    },
    prefetch: 2,
    caching: {
      useCache: true,
      // ttl: 10
    }

    // polling: {
    //   timeout: {
    //     msec: 2000
    //   },
    //   // interval: 300
    // }
  };

  const processor = new ProcessorImplementation(logger, config);
  try {
    await processor.run()
  } catch (error) {
    logger.error(error);
  }
}

main();

