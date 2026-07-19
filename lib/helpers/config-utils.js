'use strict';

const parseBoolean = (value, defaultValue) => {
  if (value === undefined) return defaultValue;
  return value === 'true';
};

const parsePositiveInteger = (value, defaultValue) => {
  if (value === undefined || value === '') return defaultValue;
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 1) {
    throw new Error(`Expected a positive integer but received '${value}'`);
  }
  return parsed;
};

const parseStringList = (value, defaultValue = []) => {
  if (value === undefined || value === '') return defaultValue;
  return value.split(',').map(item => item.trim()).filter(Boolean);
};

const isProduction = config => config.env === 'prod';

const requireValue = (value, name) => {
  if (value === undefined || value === null || value === '') {
    throw new Error(`${name} is required`);
  }
};

const validateUrl = (value, name) => {
  requireValue(value, name);
  try {
    new URL(value);
  } catch (error) {
    throw new Error(`${name} must be a valid URL`);
  }
};

const validateSecret = (value, name, minLength = 32) => {
  requireValue(value, name);
  if (value.length < minLength) {
    throw new Error(`${name} must be at least ${minLength} characters`);
  }
  if (/^replace-with/i.test(value)) {
    throw new Error(`${name} must not use the example placeholder value`);
  }
};

const validateProductionConfig = (config) => {
  if (!isProduction(config)) return;

  validateUrl(config.postgres.connectionString, 'DATABASE_URL');
  validateUrl(config.redis.url, 'REDIS_URL');
  validateSecret(config.jwt.secret, 'JWT_SECRET');
  validateSecret(config.apiKeyHash.secret, 'API_KEY_HASH_SECRET');

  if (!config.postgres.ssl?.enabled) {
    throw new Error('DB_SSL_ENABLED must be true in production');
  }
  if (config.postgres.ssl.rejectUnauthorized !== true) {
    throw new Error('DB_SSL_REJECT_UNAUTHORIZED must be true in production');
  }
  if (!config.postgres.ssl.ca && !config.postgres.ssl.caPath) {
    throw new Error('DB_CA_CERT or DB_CA_CERT_PATH is required in production when database TLS verification is enabled');
  }
  if (!config.cors?.origins || config.cors.origins.length === 0 || config.cors.origins.includes('*')) {
    throw new Error('CORS_ORIGINS must list explicit dashboard origins in production');
  }
};

module.exports = {
  parseBoolean,
  parsePositiveInteger,
  parseStringList,
  validateProductionConfig
};
