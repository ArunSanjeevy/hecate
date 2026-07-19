'use strict';

const { parseBoolean, parsePositiveInteger, parseStringList, validateProductionConfig } = require('../lib/helpers/config-utils');

const config = {
  env: 'dev',
  port: process.env.PORT || 4000,
  jwt: {
    secret: process.env.JWT_SECRET,
    issuer: process.env.JWT_ISSUER || 'hecate-api',
    audience: process.env.JWT_AUDIENCE || 'hecate-dashboard',
    expiresIn: process.env.JWT_EXPIRES_IN || '24h'
  },
  apiKeyHash: {
    secret: process.env.API_KEY_HASH_SECRET
  },
  postgres: {
    connectionString: process.env.DATABASE_URL || 'postgres://admin:hecate@localhost:5432/hecate_development',
    maxConnections: 10
  },
  redis: {
    url: process.env.REDIS_URL || 'redis://localhost:6379'
  },
  cors: {
    origins: parseStringList(process.env.CORS_ORIGINS, ['*'])
  },
  rateLimits: {
    enabled: parseBoolean(process.env.RATE_LIMIT_ENABLED, true),
    auth: {
      windowMs: parsePositiveInteger(process.env.RATE_LIMIT_AUTH_WINDOW_MS, 15 * 60 * 1000),
      max: parsePositiveInteger(process.env.RATE_LIMIT_AUTH_MAX, 50)
    },
    sdk: {
      windowMs: parsePositiveInteger(process.env.RATE_LIMIT_SDK_WINDOW_MS, 60 * 1000),
      max: parsePositiveInteger(process.env.RATE_LIMIT_SDK_MAX, 600)
    },
    controlPlane: {
      windowMs: parsePositiveInteger(process.env.RATE_LIMIT_CONTROL_WINDOW_MS, 60 * 1000),
      max: parsePositiveInteger(process.env.RATE_LIMIT_CONTROL_MAX, 300)
    }
  },
  apiKeyAuthCache: {
    enabled: parseBoolean(process.env.API_KEY_AUTH_CACHE_ENABLED, true),
    ttlSeconds: parsePositiveInteger(process.env.API_KEY_AUTH_CACHE_TTL_SECONDS, 300)
  },
  gracefulShutdown: {
    timeoutMs: parsePositiveInteger(process.env.GRACEFUL_SHUTDOWN_TIMEOUT_MS, 10000)
  },
  logDirectory: 'logs/',
  suppressLogs: false
};

validateProductionConfig(config);

module.exports = config;
