'use strict';

const redis = require('redis');
const path = require('path');

const env = process.env.NODE_ENV || 'dev';
const config = require(path.join(__dirname, `../../config/${env}-config.js`));
const logger = require('../helpers/logger');

let client = null;
let isConnected = false;

if (config.redis && config.redis.url) {
  client = redis.createClient({
    url: config.redis.url
  });

  client.on('error', (err) => {
    logger.error('Redis client error', { error: err.message });
    isConnected = false;
  });

  client.on('connect', () => {
    logger.info('Redis client connecting...');
  });

  client.on('ready', () => {
    logger.info('Redis client connected and ready');
    isConnected = true;
  });

  client.on('end', () => {
    logger.info('Redis client connection closed');
    isConnected = false;
  });
}

const connectRedis = async () => {
  if (!client) {
    logger.warn('Redis client not configured');
    return false;
  }
  try {
    await client.connect();
    return true;
  } catch (error) {
    logger.error('Could not connect to Redis', { error: error.message });
    isConnected = false;
    return false;
  }
};

const get = async (key) => {
  if (!isConnected || !client) return null;
  try {
    const val = await client.get(key);
    return val ? JSON.parse(val) : null;
  } catch (err) {
    logger.error('Redis get failure', { key, error: err.message });
    return null;
  }
};

const set = async (key, value, expirySeconds = null) => {
  if (!isConnected || !client) return false;
  try {
    const stringValue = JSON.stringify(value);
    if (expirySeconds) {
      await client.set(key, stringValue, { EX: expirySeconds });
    } else {
      await client.set(key, stringValue);
    }
    return true;
  } catch (err) {
    logger.error('Redis set failure', { key, error: err.message });
    return false;
  }
};

const del = async (key) => {
  if (!isConnected || !client) return false;
  try {
    await client.del(key);
    return true;
  } catch (err) {
    logger.error('Redis delete failure', { key, error: err.message });
    return false;
  }
};

const flushAll = async () => {
  if (!isConnected || !client) return false;
  try {
    await client.flushAll();
    return true;
  } catch (err) {
    logger.error('Redis flushAll failure', { error: err.message });
    return false;
  }
};

const ping = async () => {
  if (!isConnected || !client) return false;
  try {
    await client.ping();
    return true;
  } catch (err) {
    logger.error('Redis ping failure', { error: err.message });
    return false;
  }
};

const disconnectRedis = async () => {
  if (client) {
    try {
      await client.quit();
      isConnected = false;
    } catch (err) {
      logger.error('Redis disconnect error', { error: err.message });
    }
  }
};

module.exports = {
  client,
  connectRedis,
  disconnectRedis,
  get,
  set,
  del,
  ping,
  flushAll,
  isConnected: () => isConnected
};
