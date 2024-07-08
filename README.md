# WebSocket Redis Server

This repositorygit implements a WebSocket server that subscribes to a Redis channel and broadcasts updates to all connected WebSocket clients. It also includes a PostgreSQL to Redis updater that periodically fetches data from a PostgreSQL database and updates a Redis snapshot.

## Features

- WebSocket server with connection health checks (ping/pong)
- Subscribes to Redis channel and broadcasts updates to WebSocket clients
- Periodic PostgreSQL to Redis snapshot updates
- Robust error handling and retries

## Requirements

- Node.js
- PostgreSQL
- Redis

## Setup

```cmd

npm run dev:websocket
npm run dev:update


npm run start:update
npm run start:update

```