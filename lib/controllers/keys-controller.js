'use strict';

const crypto = require('crypto');
const keysAccessor = require('../data-accessors/keys-accessor');
const { createKeySchema } = require('../helpers/validation');

const maskApiKey = (apiKey) => `${apiKey.slice(0, 6)}${'*'.repeat(Math.max(0, apiKey.length - 10))}${apiKey.slice(-4)}`;

class KeysController {
  async listKeys(userId) {
    const keys = await keysAccessor.listByUserId(userId);
    return keys.map(k => ({
      id: k.id,
      name: k.name,
      type: k.key_type,
      apiKey: maskApiKey(k.api_key),
      expiresAt: k.expires_at,
      createdAt: k.created_at
    }));
  }

  async createKey(payload, userId) {
    const { error, value } = createKeySchema.validate(payload);
    if (error) {
      throw error;
    }

    const { name, expiresAt } = value;
    const apiKeyString = 'hk_' + crypto.randomBytes(24).toString('hex');

    const k = await keysAccessor.create({
      userId,
      apiKey: apiKeyString,
      name,
      expiresAt,
      keyType: 'sdk'
    });

    return {
      id: k.id,
      name: k.name,
      type: k.key_type,
      apiKey: k.api_key,
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
    return true;
  }
}

module.exports = new KeysController();
