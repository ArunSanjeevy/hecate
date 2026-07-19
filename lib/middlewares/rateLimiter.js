'use strict';

const Errors = require('../constants/Errors');

const defaultKeyGenerator = (req) => req.ip || req.connection.remoteAddress || 'unknown';
const credentialKeyGenerator = (req) => {
  const apiKey = req.headers && req.headers['x-api-key'];
  if (apiKey) {
    return `api-key:${apiKey}`;
  }

  const authorization = req.headers && req.headers.authorization;
  if (authorization) {
    return `authorization:${authorization}`;
  }

  return `ip:${defaultKeyGenerator(req)}`;
};

const createRateLimiter = (options) => {
  const {
    enabled = true,
    windowMs,
    max,
    keyGenerator = defaultKeyGenerator,
    store = new Map(),
    now = () => Date.now()
  } = options;

  if (!enabled) {
    return (req, res, next) => next();
  }

  return (req, res, next) => {
    const currentTime = now();
    const key = keyGenerator(req);
    const existing = store.get(key);
    const bucket = existing && existing.resetAt > currentTime
      ? existing
      : { count: 0, resetAt: currentTime + windowMs };

    bucket.count += 1;
    store.set(key, bucket);

    const remaining = Math.max(0, max - bucket.count);
    const retryAfterSeconds = Math.ceil((bucket.resetAt - currentTime) / 1000);

    res.setHeader('RateLimit-Limit', max);
    res.setHeader('RateLimit-Remaining', remaining);
    res.setHeader('RateLimit-Reset', Math.ceil(bucket.resetAt / 1000));

    if (bucket.count > max) {
      res.setHeader('Retry-After', retryAfterSeconds);
      return next(Errors.rate_limit_exceeded);
    }

    return next();
  };
};

module.exports = {
  createRateLimiter,
  credentialKeyGenerator
};
