import Redis from 'ioredis';
import dotenv from 'dotenv';
import { logger } from '@common/logger'

dotenv.config();

const redis = new Redis({
    host: process.env.REDIS_HOST || 'localhost',
    port: Number(process.env.REDIS_PORT) || 6379,
    password: process.env.REDIS_PASSWORD || '',
    db: Number(process.env.REDIS_DB) || 0,
    keyPrefix: process.env.REDIS_PREFIX || 'auth-core:',
    retryStrategy: (times) => Math.min(times * 50, 2000),
    maxRetriesPerRequest: 3,
});

redis.on('connect', () => logger.info('Redis connected'));
redis.on('error', (err) => logger.error({ err: err.message }, 'Redis error'));

export default redis;
