'use strict';

const apiKeyAuthCache = require('../../lib/cache/api-key-auth-cache');

describe('API key auth cache', () => {
  const originalEnabled = process.env.API_KEY_AUTH_CACHE_ENABLED;
  const originalTtl = process.env.API_KEY_AUTH_CACHE_TTL_SECONDS;

  const restoreEnv = (key, value) => {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  };

  beforeEach(() => {
    apiKeyAuthCache.clear();
    jest.useFakeTimers();
    jest.setSystemTime(new Date('2026-07-19T00:00:00.000Z'));
    process.env.API_KEY_AUTH_CACHE_ENABLED = 'true';
    delete process.env.API_KEY_AUTH_CACHE_TTL_SECONDS;
  });

  afterEach(() => {
    apiKeyAuthCache.clear();
    jest.useRealTimers();
    restoreEnv('API_KEY_AUTH_CACHE_ENABLED', originalEnabled);
    restoreEnv('API_KEY_AUTH_CACHE_TTL_SECONDS', originalTtl);
  });

  it('stores records until their TTL expires', () => {
    apiKeyAuthCache.set('key', { user_id: 'user-1' }, 60);

    expect(apiKeyAuthCache.get('key')).toEqual({ user_id: 'user-1' });

    jest.advanceTimersByTime(60001);

    expect(apiKeyAuthCache.get('key')).toBeNull();
  });

  it('can be disabled by configuration', () => {
    process.env.API_KEY_AUTH_CACHE_ENABLED = 'false';

    expect(apiKeyAuthCache.set('key', { user_id: 'user-1' }, 60)).toBe(false);
    expect(apiKeyAuthCache.get('key')).toBeNull();
  });

  it('deletes cached records explicitly', () => {
    apiKeyAuthCache.set('key', { user_id: 'user-1' }, 60);
    apiKeyAuthCache.del('key');

    expect(apiKeyAuthCache.get('key')).toBeNull();
  });
});
