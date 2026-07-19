'use strict';

const redisCache = require('./redis');
const logger = require('../helpers/logger');
const { parsePositiveInteger } = require('../helpers/config-utils');
const { getExperimentCacheKey } = require('../helpers/experiment-cache-key');

const ttlSeconds = parsePositiveInteger(process.env.EXPERIMENT_CACHE_TTL_SECONDS, 60);

const serializeExperiment = (experiment) => ({
  key: experiment.key,
  status: experiment.status,
  variants: experiment.variants,
  user_id: experiment.user_id
});

const get = async (userId, experimentKey) => {
  const cacheKey = getExperimentCacheKey(userId, experimentKey);
  let experiment = null;

  try {
    experiment = await redisCache.get(cacheKey);
  } catch (error) {
    logger.warn('Experiment cache read failed; falling back to PostgreSQL source of truth', {
      cacheKey,
      experimentKey,
      error: error.message
    });
    return null;
  }

  if (!experiment) return null;

  if (experiment.user_id !== userId) {
    logger.warn('Ignored tenant-mismatched experiment cache entry', {
      cacheKey,
      expectedUserId: userId,
      cachedUserId: experiment.user_id
    });
    return null;
  }

  return experiment;
};

const set = async (userId, experiment) => {
  const cacheKey = getExperimentCacheKey(userId, experiment.key);
  const cachedExperiment = serializeExperiment(experiment);

  let ok = false;
  try {
    ok = await redisCache.set(cacheKey, cachedExperiment, ttlSeconds);
  } catch (error) {
    logger.warn('Experiment cache write failed; PostgreSQL remains source of truth', {
      cacheKey,
      experimentKey: experiment.key,
      error: error.message
    });
    return false;
  }
  if (!ok) {
    logger.warn('Experiment cache write skipped or failed; PostgreSQL remains source of truth', {
      cacheKey,
      experimentKey: experiment.key
    });
  }
  return ok;
};

const del = async (userId, experimentKey) => {
  const cacheKey = getExperimentCacheKey(userId, experimentKey);
  let ok = false;
  try {
    ok = await redisCache.del(cacheKey);
  } catch (error) {
    logger.warn('Experiment cache invalidation failed; stale data is bounded by TTL', {
      cacheKey,
      experimentKey,
      error: error.message
    });
    return false;
  }
  if (!ok) {
    logger.warn('Experiment cache invalidation skipped or failed; stale data is bounded by TTL', {
      cacheKey,
      experimentKey
    });
  }
  return ok;
};

module.exports = {
  get,
  set,
  del,
  ttlSeconds
};
