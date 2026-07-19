'use strict';

const { db } = require('../data-accessors/db');
const { disconnectRedis } = require('../cache/redis');
const logger = require('./logger');
const lifecycleState = require('./lifecycle-state');

const waitWithTimeout = (promise, timeoutMs) => new Promise((resolve) => {
  const timeout = setTimeout(() => resolve('timeout'), timeoutMs);
  promise.then(() => {
    clearTimeout(timeout);
    resolve('completed');
  }).catch(() => {
    clearTimeout(timeout);
    resolve('failed');
  });
});

const closeServer = (server) => new Promise((resolve) => {
  if (!server) {
    resolve();
    return;
  }

  server.close((err) => {
    if (err) {
      logger.error('Error closing HTTP server', { error: err.message });
    } else {
      logger.info('HTTP server closed successfully');
    }
    resolve();
  });
});

function setupGracefulShutdown(server, options = {}) {
  const timeoutMs = options.timeoutMs || 10000;
  let shutdownStarted = false;

  const handler = async (signal) => {
    if (shutdownStarted) {
      logger.warn('Graceful shutdown already in progress', { signal });
      return;
    }
    shutdownStarted = true;

    logger.info(`Received ${signal}. Starting graceful shutdown...`);
    lifecycleState.markShuttingDown();

    const serverCloseStatus = await waitWithTimeout(closeServer(server), timeoutMs);
    if (serverCloseStatus === 'timeout') {
      logger.warn('Timed out while waiting for HTTP server to close', { timeoutMs });
    }

    const drainStatus = await waitWithTimeout(lifecycleState.waitForDrain(), timeoutMs);
    if (drainStatus === 'timeout') {
      logger.warn('Timed out while waiting for in-flight requests to drain', {
        timeoutMs,
        inFlightRequests: lifecycleState.getInFlightRequests()
      });
    } else {
      logger.info('In-flight requests drained successfully');
    }

    try {
      await disconnectRedis();
      logger.info('Redis connection disconnected successfully');
    } catch (err) {
      logger.error('Error disconnecting Redis client', { error: err.message });
    }

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

  return handler;
}

module.exports = setupGracefulShutdown;
