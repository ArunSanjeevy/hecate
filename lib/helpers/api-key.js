'use strict';

const crypto = require('crypto');

const KEY_PREFIX_LENGTH = 15;
const KEY_HASH_SECRET_MIN_LENGTH = 32;
const TEST_API_KEY_HASH_SECRET = 'test-only-api-key-hash-secret-not-for-prod';

const getEnv = () => process.env.NODE_ENV || 'dev';
const getConfig = () => {
  try {
    return require(`../../config/${getEnv()}-config.js`);
  } catch {
    return {};
  }
};

const getHashSecret = () => {
  const configSecret = getConfig().apiKeyHash?.secret;
  if (configSecret) {
    return configSecret;
  }

  if (process.env.API_KEY_HASH_SECRET) {
    return process.env.API_KEY_HASH_SECRET;
  }

  if (getEnv() === 'test') {
    return TEST_API_KEY_HASH_SECRET;
  }

  throw new Error('API_KEY_HASH_SECRET is required');
};

const validateApiKeyHashConfig = () => {
  const secret = getHashSecret();
  if (secret.length < KEY_HASH_SECRET_MIN_LENGTH) {
    throw new Error(`API_KEY_HASH_SECRET must be at least ${KEY_HASH_SECRET_MIN_LENGTH} characters`);
  }
};

validateApiKeyHashConfig();

const generateApiKey = () => `hk_${crypto.randomBytes(24).toString('hex')}`;

const getApiKeyPrefix = (apiKey) => apiKey.slice(0, KEY_PREFIX_LENGTH);

const hashApiKey = (apiKey) => crypto
  .createHmac('sha256', getHashSecret())
  .update(apiKey)
  .digest('hex');

const maskApiKeyPrefix = (apiKeyPrefix) => `${apiKeyPrefix}${'*'.repeat(8)}`;
const getApiKeyAuthCacheKeyFromHash = (apiKeyHash) => `api-key-auth:${apiKeyHash}`;
const getApiKeyAuthCacheKey = (apiKey) => getApiKeyAuthCacheKeyFromHash(hashApiKey(apiKey));

module.exports = {
  generateApiKey,
  getApiKeyPrefix,
  hashApiKey,
  maskApiKeyPrefix,
  getApiKeyAuthCacheKey,
  getApiKeyAuthCacheKeyFromHash,
  validateApiKeyHashConfig
};
