import Redis from 'ioredis';
import { Pool } from 'pg';
import { createLogger, format, transports } from 'winston';
import env from './config';

const logger = createLogger({
  level: env.LOG_LEVEL,
  format: format.combine(
    format.timestamp(),
    format.json()
  ),
  transports: [
    new transports.Console(),
    new transports.File({ filename: 'error.log', level: 'error' }),
    new transports.File({ filename: 'combined.log' })
  ]
});

const pgPool = new Pool({
  connectionString: env.POSTGRES_URL,
});

const redisClient = new Redis(env.REDIS_URL);

interface Event {
  id: number;
  name: string;
  signature: string;
  hash: string;
  data: string;
  block_number: number;
  transaction_hash: string;
  log_index: number;
  raw_data: string;
  address: string;
  tracker_name: string;
  created_at: string;
}

async function updateRedisSnapshot() {
  const client = await pgPool.connect();
  try {

    const query = `SELECT * FROM public.event ORDER BY id DESC LIMIT 100`;
    
    const result = await client.query<Event>(query);
    
    const snapshot = JSON.stringify(result.rows);
    
    await redisClient.set('events_snapshot', snapshot);
    
    await redisClient.publish('updates', JSON.stringify({
      type: 'events_updated',
      timestamp: new Date().toISOString()
    }));
    
    logger.info('Redis snapshot and events updated');
  } catch (err) {
    if (err instanceof Error) {
      logger.error('Error updating Redis snapshot', { error: err.stack || err.message });
    } else {
      logger.error('Error updating Redis snapshot', { error: err });
    }
  } finally {
    client.release();
  }
}

const intervalId = setInterval(updateRedisSnapshot, env.UPDATE_INTERVAL);

logger.info('PostgreSQL to Redis updater is running');

process.on('SIGTERM', () => {
  logger.info('SIGTERM signal received: closing updater');
  clearInterval(intervalId);
  pgPool.end();
  redisClient.quit();
});
