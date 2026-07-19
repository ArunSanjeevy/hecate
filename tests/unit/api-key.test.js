'use strict';

describe('API key helper', () => {
  const originalNodeEnv = process.env.NODE_ENV;
  const originalApiKeyHashSecret = process.env.API_KEY_HASH_SECRET;

  const restoreEnv = (key, value) => {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  };

  const loadApiKeyHelper = () => {
    jest.resetModules();
    return require('../../lib/helpers/api-key');
  };

  afterEach(() => {
    restoreEnv('NODE_ENV', originalNodeEnv);
    restoreEnv('API_KEY_HASH_SECRET', originalApiKeyHashSecret);
    jest.resetModules();
  });

  it('generates API keys and derives stable lookup values without storing plaintext', () => {
    process.env.NODE_ENV = 'test';
    process.env.API_KEY_HASH_SECRET = 'unit-test-api-key-secret-with-32-chars';

    const apiKeyHelper = loadApiKeyHelper();
    const apiKey = apiKeyHelper.generateApiKey();
    const prefix = apiKeyHelper.getApiKeyPrefix(apiKey);
    const hash = apiKeyHelper.hashApiKey(apiKey);

    expect(apiKey).toMatch(/^hk_[a-f0-9]{48}$/);
    expect(prefix).toBe(apiKey.slice(0, 15));
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
    expect(hash).not.toBe(apiKey);
    expect(apiKeyHelper.hashApiKey(apiKey)).toBe(hash);
  });

  it('requires API_KEY_HASH_SECRET outside tests', () => {
    process.env.NODE_ENV = 'prod';
    delete process.env.API_KEY_HASH_SECRET;

    expect(loadApiKeyHelper).toThrow('API_KEY_HASH_SECRET is required');
  });

  it('rejects weak API key hash secrets', () => {
    process.env.NODE_ENV = 'prod';
    process.env.API_KEY_HASH_SECRET = 'too-short';

    expect(loadApiKeyHelper).toThrow('API_KEY_HASH_SECRET must be at least 32 characters');
  });
});

