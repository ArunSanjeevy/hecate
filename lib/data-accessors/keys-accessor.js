'use strict';

const { db } = require('./db');
const Constants = require('../constants/Constants');

class KeysAccessor {
  async create(keyData) {
    const { userId, apiKey, name, expiresAt, keyType = 'sdk' } = keyData;
    const query = `
      INSERT INTO ${Constants.Tables.UserApiKeys} (user_id, api_key, name, key_type, expires_at)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id, user_id, api_key, name, key_type, expires_at, created_at
    `;
    const result = await db.one(query, [userId, apiKey, name, keyType, expiresAt || null]);
    return result;
  }

  async listByUserId(userId) {
    const query = `
      SELECT id, user_id, api_key, name, key_type, expires_at, created_at
      FROM ${Constants.Tables.UserApiKeys}
      WHERE user_id = $1
        AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)
      ORDER BY created_at DESC
    `;
    const result = await db.any(query, [userId]);
    return result;
  }

  async deleteById(id, userId) {
    const query = `
      DELETE FROM ${Constants.Tables.UserApiKeys}
      WHERE id = $1 AND user_id = $2
      RETURNING id
    `;
    const result = await db.oneOrNone(query, [id, userId]);
    return result;
  }

  async getByKey(apiKey, keyTypes = null) {
    const query = `
      SELECT id, user_id, api_key, name, key_type, expires_at, created_at
      FROM ${Constants.Tables.UserApiKeys}
      WHERE api_key = $1
        AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)
        AND ($2::text[] IS NULL OR key_type = ANY($2::text[]))
    `;
    const result = await db.oneOrNone(query, [apiKey, keyTypes]);
    return result;
  }
}

module.exports = new KeysAccessor();
