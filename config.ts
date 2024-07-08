import dotenv from 'dotenv';
import { cleanEnv, num, port, str } from 'envalid';

dotenv.config();

const env = cleanEnv(process.env, {
  NODE_ENV: str({ choices: ['development', 'test', 'production'], default: 'development' }),
  PORT: port({ default: 3000 }),
  REDIS_URL: str({ default: 'redis://localhost:6379' }),
  POSTGRES_URL: str(),
  UPDATE_INTERVAL: num({ default: 15000 }), // 15 seconds
  LOG_LEVEL: str({ choices: ['error', 'warn', 'info', 'debug'], default: 'info' }),
});

export default env;
