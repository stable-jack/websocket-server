import express from 'express';
import http from 'http';
import Redis from 'ioredis';
import { createLogger, format, transports } from 'winston';
import WebSocket from 'ws';
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

const redisClient = new Redis(env.REDIS_URL);
const redisSubscriber = redisClient.duplicate();

const app = express();
const server = http.createServer(app);

const wss = new WebSocket.Server({ server });

interface ExtWebSocket extends WebSocket {
  isAlive: boolean;
}

// Redis subscription with retries
async function subscribeToRedisChannel() {
  try {
    await redisSubscriber.subscribe('updates');
    logger.info('Subscribed to Redis updates channel');
  } catch (err) {
    if (err instanceof Error) {
      logger.error('Failed to subscribe to Redis channel', { error: err.message });
    } else {
      logger.error('Failed to subscribe to Redis channel', { error: err });
    }
    setTimeout(subscribeToRedisChannel, 5000); // Retry after 5 seconds
  }
}

redisSubscriber.on('message', async (channel, message) => {
  if (channel === 'updates') {
    try {
      const snapshot = await redisClient.get('events_snapshot');
      broadcastToAll(snapshot || message);
    } catch (err) {
      if (err instanceof Error) {
        logger.error('Error fetching snapshot from Redis', { error: err.message });
      } else {
        logger.error('Error fetching snapshot from Redis', { error: err });
      }
    }
  }
});

wss.on('connection', (ws: ExtWebSocket) => {
  logger.info('New WebSocket connection');

  ws.isAlive = true;
  ws.on('pong', () => {
    ws.isAlive = true;
  });

  sendSnapshot(ws);

  ws.on('close', () => {
    logger.info('WebSocket connection closed');
  });
});

// Function to send snapshot from Redis
async function sendSnapshot(ws: WebSocket) {
  try {
    const snapshot = await redisClient.get('events_snapshot');
    if (snapshot) {
      ws.send(snapshot);
    }
  } catch (err) {
    if (err instanceof Error) {
      logger.error('Error fetching snapshot from Redis', { error: err.message });
    } else {
      logger.error('Error fetching snapshot from Redis', { error: err });
    }
  }
}

// Function to broadcast message to all connected clients
function broadcastToAll(message: string) {
  wss.clients.forEach((client) => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  });
}

// WebSocket heartbeat
function heartbeat() {
  wss.clients.forEach((ws) => {
    const extWs = ws as ExtWebSocket;
    if (!extWs.isAlive) return ws.terminate();

    extWs.isAlive = false;
    ws.ping();
  });
}

const interval = setInterval(heartbeat, 30000); // Ping every 30 seconds

server.listen(env.PORT, () => {
  logger.info(`WebSocket server is running on port ${env.PORT}`);
  subscribeToRedisChannel();
});

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM signal received: closing HTTP server');
  clearInterval(interval);
  server.close(() => {
    logger.info('HTTP server closed');
  });
  redisClient.quit();
  redisSubscriber.quit();
});
