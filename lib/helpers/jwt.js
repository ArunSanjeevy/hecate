'use strict';

const jwt = require('jsonwebtoken');

const DEFAULT_ISSUER = 'hecate-api';
const DEFAULT_AUDIENCE = 'hecate-dashboard';
const DEFAULT_EXPIRES_IN = '24h';
const MIN_SECRET_LENGTH = 32;
const TEST_JWT_SECRET = 'test-only-jwt-secret-must-not-be-used-in-prod';

const getEnv = () => process.env.NODE_ENV || 'dev';
const getConfig = () => {
  try {
    return require(`../../config/${getEnv()}-config.js`);
  } catch {
    return {};
  }
};

const getJwtSecret = () => {
  const configSecret = getConfig().jwt?.secret;
  if (configSecret) {
    return configSecret;
  }

  if (process.env.JWT_SECRET) {
    return process.env.JWT_SECRET;
  }

  if (getEnv() === 'test') {
    return TEST_JWT_SECRET;
  }

  throw new Error('JWT_SECRET is required');
};

const getJwtIssuer = () => getConfig().jwt?.issuer || process.env.JWT_ISSUER || DEFAULT_ISSUER;
const getJwtAudience = () => getConfig().jwt?.audience || process.env.JWT_AUDIENCE || DEFAULT_AUDIENCE;
const getJwtExpiresIn = () => getConfig().jwt?.expiresIn || process.env.JWT_EXPIRES_IN || DEFAULT_EXPIRES_IN;

const validateJwtConfig = () => {
  const secret = getJwtSecret();

  if (secret.length < MIN_SECRET_LENGTH) {
    throw new Error(`JWT_SECRET must be at least ${MIN_SECRET_LENGTH} characters`);
  }
};

validateJwtConfig();

const sign = (payload, options = {}) => {
  const subject = payload.sub || payload.userId || options.subject;
  if (!subject) {
    throw new Error('JWT subject is required');
  }
  const { sub, iat, exp, iss, aud, ...customClaims } = payload;

  return jwt.sign(
    {
      ...customClaims,
      userId: customClaims.userId || subject
    },
    getJwtSecret(),
    {
      algorithm: 'HS256',
      subject,
      issuer: options.issuer || getJwtIssuer(),
      audience: options.audience || getJwtAudience(),
      expiresIn: options.expiresIn || getJwtExpiresIn()
    }
  );
};

const verify = (token) => {
  try {
    if (!token) return null;

    return jwt.verify(token, getJwtSecret(), {
      algorithms: ['HS256'],
      issuer: getJwtIssuer(),
      audience: getJwtAudience()
    });
  } catch (err) {
    return null;
  }
};

module.exports = {
  sign,
  verify,
  validateJwtConfig
};
