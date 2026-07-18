'use strict';

require('dotenv').config();
process.env.NODE_ENV = process.env.NODE_ENV || 'dev';

const redisCache = require('../lib/cache/redis');

const clearExperimentCache = async () => {
  const experimentKey = process.argv[2];
  if (!experimentKey) {
    console.error('Usage: npm run cache:clear-experiment -- <experiment_key>');
    process.exit(1);
  }

  try {
    await redisCache.connectRedis();
    await redisCache.del(`experiment:${experimentKey}`);
    await redisCache.disconnectRedis();
    console.log(`Cleared cache key experiment:${experimentKey}`);
    process.exit(0);
  } catch (error) {
    console.error('Failed to clear experiment cache:', error.message);
    await redisCache.disconnectRedis();
    process.exit(1);
  }
};

clearExperimentCache();
