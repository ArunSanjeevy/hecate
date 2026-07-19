'use strict';

const { db } = require('../../lib/data-accessors/db');
const apiKeyHelper = require('../../lib/helpers/api-key');

const TEST_SERVICE_USER_ID = '00000000-0000-0000-0000-000000000001';
const TEST_SERVICE_API_KEY = 'dev-api-key';

const ensureTestServiceKey = async () => {
  await db.none(`
    INSERT INTO users (id, email, password_hash)
    VALUES ($1, $2, $3)
    ON CONFLICT (id) DO NOTHING
  `, [TEST_SERVICE_USER_ID, 'integration-service@hecate.test', 'pbkdf2$test$password_hash']);

  await db.none(`
    INSERT INTO user_api_keys (user_id, api_key_prefix, api_key_hash, name, key_type)
    VALUES ($1, $2, $3, $4, $5)
    ON CONFLICT (api_key_hash) DO NOTHING
  `, [
    TEST_SERVICE_USER_ID,
    apiKeyHelper.getApiKeyPrefix(TEST_SERVICE_API_KEY),
    apiKeyHelper.hashApiKey(TEST_SERVICE_API_KEY),
    'Integration Test Service Key',
    'service'
  ]);
};

module.exports = {
  ensureTestServiceKey,
  TEST_SERVICE_API_KEY
};
