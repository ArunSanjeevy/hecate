'use strict';

const keysAccessor = require('../data-accessors/keys-accessor');
const { createKeySchema, paginationSchema } = require('../helpers/validation');
const apiKeyHelper = require('../helpers/api-key');
const apiKeyAuthCache = require('../cache/api-key-auth-cache');

class KeysController {
  async listKeys(userId, query = {}) {
    const { error, value: pagination } = paginationSchema.validate(query, { convert: true });
    if (error) {
      throw error;
    }

    const [keys, total] = await Promise.all([
      keysAccessor.listByUserId(userId, pagination),
      keysAccessor.countByUserId(userId)
    ]);

    return {
      keys: keys.map(k => ({
      id: k.id,
      name: k.name,
      type: k.key_type,
      apiKey: apiKeyHelper.maskApiKeyPrefix(k.api_key_prefix),
      expiresAt: k.expires_at,
      createdAt: k.created_at
      })),
      pagination: {
        limit: pagination.limit,
        offset: pagination.offset,
        total,
        hasMore: pagination.offset + keys.length < total
      }
    };
  }

  async createKey(payload, userId) {
    const { error, value } = createKeySchema.validate(payload);
    if (error) {
      throw error;
    }

    const { name, expiresAt } = value;
    const apiKeyString = apiKeyHelper.generateApiKey();

    const k = await keysAccessor.create({
      userId,
      apiKeyPrefix: apiKeyHelper.getApiKeyPrefix(apiKeyString),
      apiKeyHash: apiKeyHelper.hashApiKey(apiKeyString),
      name,
      expiresAt,
      keyType: 'sdk'
    });

    return {
      id: k.id,
      name: k.name,
      type: k.key_type,
      apiKey: apiKeyString,
      expiresAt: k.expires_at,
      createdAt: k.created_at
    };
  }

  async revokeKey(id, userId) {
    const result = await keysAccessor.deleteById(id, userId);
    if (!result) {
      throw {
        status_code: 404,
        error_code: 'key_not_found',
        error_message: 'API Key not found'
      };
    }
    apiKeyAuthCache.del(apiKeyHelper.getApiKeyAuthCacheKeyFromHash(result.api_key_hash));
    return true;
  }
}

module.exports = new KeysController();
