'use strict';

const fs = require('fs');
const path = require('path');
const { db } = require('../data-accessors/db');
const logger = require('./logger');

const migrate = async () => {
  try {
    const schemaPath = path.join(__dirname, '../sql/schema.sql');
    const sql = fs.readFileSync(schemaPath, 'utf8');
    logger.info('Executing database schema migration...');
    await db.none(sql);

    logger.info('Database schema migration completed successfully');
    return true;
  } catch (error) {
    logger.error('Database schema migration failed', { error: error.message });
    throw error;
  }
};

module.exports = migrate;
