import Queue from 'bull';
import { config } from '../config';

export const submissionQueue = new Queue('submission-queue', config.redis.url, {
  defaultJobOptions: {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000,
    },
    removeOnComplete: true,
    removeOnFail: false,
  },
});

export const runQueue = new Queue('run-queue', config.redis.url, {
  defaultJobOptions: {
    attempts: 2,
    removeOnComplete: true,
    removeOnFail: true,
  },
});
