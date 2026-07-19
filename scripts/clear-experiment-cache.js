'use strict';

require('dotenv').config();
process.env.NODE_ENV = process.env.NODE_ENV || 'dev';

const redisCache = require('../lib/cache/redis');
const experimentCache = require('../lib/cache/experiment-cache');

const clearExperimentCache = async () => {
  const userId = process.argv[2];
  const experimentKey = process.argv[3];
  if (!userId || !experimentKey) {
    console.error('Usage: npm run cache:clear-experiment -- <user_id> <experiment_key>');
    process.exit(1);
  }

  try {
    await redisCache.connectRedis();
    await experimentCache.del(userId, experimentKey);
    await redisCache.disconnectRedis();
    console.log(`Cleared cache for user ${userId}, experiment ${experimentKey}`);
    process.exit(0);
  } catch (error) {
    console.error('Failed to clear experiment cache:', error.message);
    await redisCache.disconnectRedis();
    process.exit(1);
  }
};

clearExperimentCache();
