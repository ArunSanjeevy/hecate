'use strict';

const { db } = require('./db');
const Constants = require('../constants/Constants');
const apiKeyHelper = require('../helpers/api-key');

class KeysAccessor {
  async create(keyData) {
    const { userId, apiKeyPrefix, apiKeyHash, name, expiresAt, keyType = 'sdk' } = keyData;
    const query = `
      INSERT INTO ${Constants.Tables.UserApiKeys} (user_id, api_key_prefix, api_key_hash, name, key_type, expires_at)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING id, user_id, api_key_prefix, name, key_type, expires_at, created_at
    `;
    const result = await db.one(query, [userId, apiKeyPrefix, apiKeyHash, name, keyType, expiresAt || null]);
    return result;
  }

  async listByUserId(userId, pagination = { limit: 20, offset: 0 }) {
    const { limit, offset } = pagination;
    const query = `
      SELECT id, user_id, api_key_prefix, name, key_type, expires_at, created_at
      FROM ${Constants.Tables.UserApiKeys}
      WHERE user_id = $1
        AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)
      ORDER BY created_at DESC, id ASC
      LIMIT $2 OFFSET $3
    `;
    const result = await db.any(query, [userId, limit, offset]);
    return result;
  }

  async countByUserId(userId) {
    const query = `
      SELECT COUNT(*)::int AS total
      FROM ${Constants.Tables.UserApiKeys}
      WHERE user_id = $1
        AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)
    `;
    const result = await db.one(query, [userId]);
    return result.total;
  }

  async deleteById(id, userId) {
    const query = `
      DELETE FROM ${Constants.Tables.UserApiKeys}
      WHERE id = $1 AND user_id = $2
      RETURNING id, api_key_hash
    `;
    const result = await db.oneOrNone(query, [id, userId]);
    return result;
  }

  async getByKey(apiKey, keyTypes = null) {
    const apiKeyPrefix = apiKeyHelper.getApiKeyPrefix(apiKey);
    const apiKeyHash = apiKeyHelper.hashApiKey(apiKey);
    const query = `
      SELECT id, user_id, api_key_prefix, api_key_hash, name, key_type, expires_at, created_at
      FROM ${Constants.Tables.UserApiKeys}
      WHERE api_key_prefix = $1
        AND api_key_hash = $2
        AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)
        AND ($3::text[] IS NULL OR key_type = ANY($3::text[]))
    `;
    const result = await db.oneOrNone(query, [apiKeyPrefix, apiKeyHash, keyTypes]);
    return result;
  }
}

module.exports = new KeysAccessor();
