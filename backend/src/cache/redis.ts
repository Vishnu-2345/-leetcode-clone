import { createClient } from 'redis';
import { config } from '../config';
import { logger } from '../utils/logger';

export const redisClient = createClient({
  url: config.redis.url,
});

redisClient.on('error', (err) => logger.error('Redis Client Error', err));
redisClient.on('connect', () => logger.info('Redis Client Connected'));

export const connectRedis = async (): Promise<void> => {
  await redisClient.connect();
};

export const disconnectRedis = async (): Promise<void> => {
  await redisClient.quit();
};
