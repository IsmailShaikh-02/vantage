import { Queue } from 'bullmq';
import { redisConnection } from '../config/redis.js';

export const DEPROVISION_QUEUE_NAME = 'deprovision-fanout-queue';

export const deprovisionQueue = new Queue(DEPROVISION_QUEUE_NAME, {
  connection: redisConnection,
  defaultJobOptions: {
    attempts: 3, // Retry failed attempts up to 3 times
    backoff: {
      type: 'exponential',
      delay: 1000, // 1s on attempt 1, 2s on attempt 2, 4s on attempt 3
    },
    removeOnComplete: {
      age: 86400, // Keep completed job metadata in Redis for 24 hours (in seconds)
    },
    removeOnFail: false, // Never auto-delete failed jobs; keep for SecOps inspection
  },
});