'use strict';

const { parseBoolean, parsePositiveInteger } = require('../helpers/config-utils');

const cache = new Map();

const getDefaultEnabled = () => (process.env.NODE_ENV || 'dev') !== 'test';
const isEnabled = () => parseBoolean(process.env.API_KEY_AUTH_CACHE_ENABLED, getDefaultEnabled());
const getTtlSeconds = () => parsePositiveInteger(process.env.API_KEY_AUTH_CACHE_TTL_SECONDS, 300);

const get = (cacheKey) => {
  if (!isEnabled()) return null;

  const entry = cache.get(cacheKey);
  if (!entry) return null;

  if (entry.expiresAt <= Date.now()) {
    cache.delete(cacheKey);
    return null;
  }

  return entry.value;
};

const set = (cacheKey, value, ttlSeconds = getTtlSeconds()) => {
  if (!isEnabled() || ttlSeconds < 1) return false;

  cache.set(cacheKey, {
    value,
    expiresAt: Date.now() + (ttlSeconds * 1000)
  });
  return true;
};

const del = (cacheKey) => {
  cache.delete(cacheKey);
};

const clear = () => {
  cache.clear();
};

module.exports = {
  get,
  set,
  del,
  clear
};
