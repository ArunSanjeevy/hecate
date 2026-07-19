'use strict';

require('dotenv').config();
process.env.NODE_ENV = process.env.NODE_ENV || 'dev';

const { db, checkDbConnection } = require('../lib/data-accessors/db');
const redisCache = require('../lib/cache/redis');
const experimentCache = require('../lib/cache/experiment-cache');
const logger = require('../lib/helpers/logger');

const seed = async () => {
  try {
    await checkDbConnection();
    
    const experimentKey = 'landing_page_tagline';
    const userId = '00000000-0000-0000-0000-000000000000';
    const variants = [
      { key: 'control', allocation: 50 },
      { key: 'treatment', allocation: 50 }
    ];
    
    logger.info(`Checking if experiment '${experimentKey}' already exists...`);
    const existing = await db.oneOrNone(
      'SELECT id FROM experiments WHERE user_id = $1 AND key = $2',
      [userId, experimentKey]
    );
    
    if (existing) {
      logger.info(`Experiment '${experimentKey}' already exists. Updating variants and status to active...`);
      await db.none(
        'UPDATE experiments SET status = $1, variants = $2::jsonb, updated_at = CURRENT_TIMESTAMP WHERE user_id = $3 AND key = $4',
        ['active', JSON.stringify(variants), userId, experimentKey]
      );
      logger.info(`Experiment '${experimentKey}' updated successfully.`);
    } else {
      logger.info(`Creating experiment '${experimentKey}'...`);
      await db.none(
        'INSERT INTO experiments (key, status, variants, user_id) VALUES ($1, $2, $3::jsonb, $4)',
        [experimentKey, 'active', JSON.stringify(variants), userId]
      );
      logger.info(`Experiment '${experimentKey}' created successfully.`);
    }

    await redisCache.connectRedis();
    await experimentCache.set(userId, {
      key: experimentKey,
      status: 'active',
      variants,
      user_id: userId
    });
    await redisCache.disconnectRedis();
    logger.info(`Experiment '${experimentKey}' cache refreshed successfully.`);
    
    logger.info('Database seeding completed.');
    process.exit(0);
  } catch (error) {
    logger.error('Failed to seed database:', error);
    process.exit(1);
  }
};

seed();
