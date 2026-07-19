'use strict';

const { createRateLimiter, credentialKeyGenerator } = require('../../lib/middlewares/rateLimiter');

const createResponse = () => ({
  headers: {},
  setHeader(name, value) {
    this.headers[name] = value;
  }
});

describe('rate limiter middleware', () => {
  it('allows requests under the configured limit and rejects excess requests', () => {
    const store = new Map();
    const now = jest.fn(() => 1000);
    const limiter = createRateLimiter({
      windowMs: 60000,
      max: 2,
      store,
      now,
      keyGenerator: () => 'client-1'
    });

    const firstNext = jest.fn();
    const secondNext = jest.fn();
    const thirdNext = jest.fn();

    limiter({}, createResponse(), firstNext);
    limiter({}, createResponse(), secondNext);
    const thirdResponse = createResponse();
    limiter({}, thirdResponse, thirdNext);

    expect(firstNext).toHaveBeenCalledWith();
    expect(secondNext).toHaveBeenCalledWith();
    expect(thirdNext).toHaveBeenCalledWith(expect.objectContaining({
      error_code: 'rate_limit_exceeded',
      status_code: 429
    }));
    expect(thirdResponse.headers['Retry-After']).toBe(60);
  });

  it('starts a new bucket after the configured window resets', () => {
    const store = new Map();
    let currentTime = 1000;
    const limiter = createRateLimiter({
      windowMs: 1000,
      max: 1,
      store,
      now: () => currentTime,
      keyGenerator: () => 'client-1'
    });

    const firstNext = jest.fn();
    const secondNext = jest.fn();

    limiter({}, createResponse(), firstNext);
    currentTime = 2001;
    limiter({}, createResponse(), secondNext);

    expect(firstNext).toHaveBeenCalledWith();
    expect(secondNext).toHaveBeenCalledWith();
  });

  it('passes through when disabled', () => {
    const limiter = createRateLimiter({ enabled: false, windowMs: 1, max: 1 });
    const next = jest.fn();

    limiter({}, createResponse(), next);

    expect(next).toHaveBeenCalledWith();
  });

  it('can generate limiter keys from credentials before falling back to IP', () => {
    expect(credentialKeyGenerator({
      headers: { 'x-api-key': 'hk_test' },
      ip: '127.0.0.1'
    })).toBe('api-key:hk_test');

    expect(credentialKeyGenerator({
      headers: { authorization: 'Bearer token' },
      ip: '127.0.0.1'
    })).toBe('authorization:Bearer token');

    expect(credentialKeyGenerator({
      headers: {},
      ip: '127.0.0.1'
    })).toBe('ip:127.0.0.1');
  });
});
