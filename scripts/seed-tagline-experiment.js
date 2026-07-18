'use strict';

require('dotenv').config();
process.env.NODE_ENV = process.env.NODE_ENV || 'dev';

const { db, checkDbConnection } = require('../lib/data-accessors/db');
const redisCache = require('../lib/cache/redis');
const logger = require('../lib/helpers/logger');

const seed = async () => {
  try {
    await checkDbConnection();
    
    const experimentKey = 'landing_page_tagline';
    const variants = [
      { key: 'control', allocation: 50 },
      { key: 'treatment', allocation: 50 }
    ];
    
    logger.info(`Checking if experiment '${experimentKey}' already exists...`);
    const existing = await db.oneOrNone('SELECT id FROM experiments WHERE key = $1', [experimentKey]);
    
    if (existing) {
      logger.info(`Experiment '${experimentKey}' already exists. Updating variants and status to active...`);
      await db.none(
        'UPDATE experiments SET status = $1, variants = $2::jsonb, updated_at = CURRENT_TIMESTAMP WHERE key = $3',
        ['active', JSON.stringify(variants), experimentKey]
      );
      logger.info(`Experiment '${experimentKey}' updated successfully.`);
    } else {
      logger.info(`Creating experiment '${experimentKey}'...`);
      await db.none(
        'INSERT INTO experiments (key, status, salt, variants) VALUES ($1, $2, $3, $4::jsonb)',
        [experimentKey, 'active', 'v1', JSON.stringify(variants)]
      );
      logger.info(`Experiment '${experimentKey}' created successfully.`);
    }

    await redisCache.connectRedis();
    await redisCache.set(`experiment:${experimentKey}`, {
      key: experimentKey,
      status: 'active',
      salt: 'v1',
      variants
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
