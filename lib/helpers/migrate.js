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

    // Seed default user and API key for backward compatibility/testing
    logger.info('Seeding default user and API key if not present...');
    const defaultUserId = '00000000-0000-0000-0000-000000000000';
    const defaultEmail = 'dev@hecate.io';
    const defaultPasswordHash = 'pbkdf2$default$password_hash'; // Dummy hash for default user

    await db.none(`
      INSERT INTO users (id, email, password_hash)
      VALUES ($1, $2, $3)
      ON CONFLICT (email) DO NOTHING
    `, [defaultUserId, defaultEmail, defaultPasswordHash]);

    await db.none(`
      INSERT INTO user_api_keys (user_id, api_key, name, key_type)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (api_key) DO NOTHING
    `, [defaultUserId, 'dev-api-key', 'Default Dev Key', 'service']);

    // The compatibility key is intentionally privileged for local development only.
    await db.none(`UPDATE user_api_keys SET key_type = 'service' WHERE api_key = $1`, ['dev-api-key']);

    await db.none(`
      UPDATE experiments SET user_id = $1 WHERE user_id IS NULL
    `, [defaultUserId]);

    logger.info('Database schema migration completed successfully');
    return true;
  } catch (error) {
    logger.error('Database schema migration failed', { error: error.message });
    throw error;
  }
};

module.exports = migrate;
