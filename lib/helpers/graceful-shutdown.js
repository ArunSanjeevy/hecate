'use strict';

const { db } = require('../data-accessors/db');
const { disconnectRedis } = require('../cache/redis');
const logger = require('./logger');

function setupGracefulShutdown(server) {
  const handler = async (signal) => {
    logger.info(`Received ${signal}. Starting graceful shutdown...`);

    // 1. Close HTTP server
    if (server) {
      server.close((err) => {
        if (err) {
          logger.error('Error closing HTTP server', { error: err.message });
        } else {
          logger.info('HTTP server closed successfully');
        }
      });
    }

    // 2. Disconnect Redis
    try {
      await disconnectRedis();
      logger.info('Redis connection disconnected successfully');
    } catch (err) {
      logger.error('Error disconnecting Redis client', { error: err.message });
    }

    // 3. Close PostgreSQL pool
    try {
      await db.$pool.end();
      logger.info('PostgreSQL connection pool closed successfully');
    } catch (err) {
      logger.error('Error closing PostgreSQL pool', { error: err.message });
    }

    logger.info('Graceful shutdown completed. Exiting process.');
    process.exit(0);
  };

  process.on('SIGTERM', () => handler('SIGTERM'));
  process.on('SIGINT', () => handler('SIGINT'));
}

module.exports = setupGracefulShutdown;
