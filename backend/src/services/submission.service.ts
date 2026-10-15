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

// This will be processed by the execution engine
submissionQueue.process('execute-submission', async (job) => {
  // The execution engine will handle this
  // This is just a placeholder
  console.log('Submission job created:', job.id);
  return { success: true };
});
