'use strict';

require('dotenv').config();
process.env.NODE_ENV = process.env.NODE_ENV || 'dev';

const migrate = require('../lib/helpers/migrate');
const { db } = require('../lib/data-accessors/db');
const logger = require('../lib/helpers/logger');

const run = async () => {
  try {
    await migrate();
    logger.info('Database migration command completed.');
  } catch (error) {
    logger.error('Database migration command failed', { error: error.message });
    process.exitCode = 1;
  } finally {
    await db.$pool.end();
  }
};

run();
