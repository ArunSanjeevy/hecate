'use strict';

const originalExperimentCacheTtl = process.env.EXPERIMENT_CACHE_TTL_SECONDS;
process.env.EXPERIMENT_CACHE_TTL_SECONDS = '42';

jest.mock('../../lib/cache/redis', () => ({
  get: jest.fn(),
  set: jest.fn(),
  del: jest.fn()
}));

jest.mock('../../lib/helpers/logger', () => ({
  warn: jest.fn(),
  error: jest.fn(),
  info: jest.fn()
}));

const redisCache = require('../../lib/cache/redis');
const experimentCache = require('../../lib/cache/experiment-cache');

describe('experiment-cache', () => {
  afterAll(() => {
    if (originalExperimentCacheTtl === undefined) {
      delete process.env.EXPERIMENT_CACHE_TTL_SECONDS;
    } else {
      process.env.EXPERIMENT_CACHE_TTL_SECONDS = originalExperimentCacheTtl;
    }
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('writes experiment cache entries with tenant-aware keys and TTL', async () => {
    redisCache.set.mockResolvedValue(true);

    await experimentCache.set('user-1', {
      key: 'checkout',
      status: 'active',
      variants: [{ key: 'control', allocation: 100 }],
      user_id: 'user-1',
      ignored: 'not cached'
    });

    expect(redisCache.set).toHaveBeenCalledWith(
      'experiment:user-1:checkout',
      {
        key: 'checkout',
        status: 'active',
        variants: [{ key: 'control', allocation: 100 }],
        user_id: 'user-1'
      },
      42
    );
  });

  test('ignores tenant-mismatched cache entries', async () => {
    redisCache.get.mockResolvedValue({
      key: 'checkout',
      status: 'active',
      variants: [],
      user_id: 'other-user'
    });

    const result = await experimentCache.get('user-1', 'checkout');

    expect(result).toBeNull();
  });

  test('treats Redis read failures as cache misses', async () => {
    redisCache.get.mockRejectedValue(new Error('redis down'));

    const result = await experimentCache.get('user-1', 'checkout');

    expect(result).toBeNull();
  });

  test('deletes experiment cache entries by tenant-aware key', async () => {
    redisCache.del.mockResolvedValue(true);

    await experimentCache.del('user-1', 'checkout');

    expect(redisCache.del).toHaveBeenCalledWith('experiment:user-1:checkout');
  });
});
