'use strict';

const Errors = require('../constants/Errors');
const keysAccessor = require('../data-accessors/keys-accessor');
const jwtHelper = require('../helpers/jwt');
const apiKeyHelper = require('../helpers/api-key');
const apiKeyAuthCache = require('../cache/api-key-auth-cache');

const isAllowedKeyType = (keyType, allowedKeyTypes) => {
  return !allowedKeyTypes || allowedKeyTypes.includes(keyType);
};

const isExpired = (expiresAt) => {
  return expiresAt && new Date(expiresAt) < new Date();
};

const getCacheTtlSeconds = (expiresAt) => {
  const defaultTtlSeconds = Number(process.env.API_KEY_AUTH_CACHE_TTL_SECONDS || 300);
  if (!expiresAt) {
    return defaultTtlSeconds;
  }

  const secondsUntilExpiry = Math.floor((new Date(expiresAt).getTime() - Date.now()) / 1000);
  return Math.min(defaultTtlSeconds, secondsUntilExpiry);
};

const serializeKeyRecord = (keyRecord) => ({
  id: keyRecord.id,
  user_id: keyRecord.user_id,
  key_type: keyRecord.key_type,
  expires_at: keyRecord.expires_at
});

/**
 * Middleware to authenticate requests using API key (x-api-key header)
 */
const authenticateApiKey = (allowedKeyTypes) => async (req, res, next) => {
  try {
    const apiKey = req.headers['x-api-key'];
    if (!apiKey) {
      return next(Errors.authentication_failed);
    }

    const cacheKey = apiKeyHelper.getApiKeyAuthCacheKey(apiKey);
    let keyRecord = apiKeyAuthCache.get(cacheKey);

    if (keyRecord && (!isAllowedKeyType(keyRecord.key_type, allowedKeyTypes) || isExpired(keyRecord.expires_at))) {
      return next(Errors.authentication_failed);
    }

    if (!keyRecord) {
      keyRecord = await keysAccessor.getByKey(apiKey, null);
      if (keyRecord && !isExpired(keyRecord.expires_at)) {
        const ttlSeconds = getCacheTtlSeconds(keyRecord.expires_at);
        if (ttlSeconds > 0) {
          apiKeyAuthCache.set(cacheKey, serializeKeyRecord(keyRecord), ttlSeconds);
        }
      }
    }

    if (!keyRecord) {
      return next(Errors.authentication_failed);
    }

    // Check if expired
    if (isExpired(keyRecord.expires_at) || !isAllowedKeyType(keyRecord.key_type, allowedKeyTypes)) {
      return next(Errors.authentication_failed);
    }

    // Populate user context
    req.user = {
      id: keyRecord.user_id
    };
    req.auth = { type: 'api_key', keyType: keyRecord.key_type };

    return next();
  } catch (err) {
    return next(err);
  }
};

/**
 * Middleware to authenticate user sessions using Bearer JWT tokens
 */
const authenticateUser = async (req, res, next) => {
  try {
    const authHeader = req.headers['authorization'];
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return next(Errors.authentication_failed);
    }

    const token = authHeader.substring(7); // Remove 'Bearer '
    const payload = jwtHelper.verify(token);
    if (!payload) {
      return next(Errors.authentication_failed);
    }

    // Populate user context from JWT token payload
    req.user = {
      id: payload.sub,
      email: payload.email
    };
    req.auth = { type: 'jwt' };

    return next();
  } catch (err) {
    return next(err);
  }
};

// Control-plane routes are intended for the dashboard (JWT). A service key is
// supported only for trusted server-to-server automation, never for SDK keys.
const authenticateControlPlane = async (req, res, next) => {
  if (req.headers.authorization) {
    return authenticateUser(req, res, next);
  }
  return authenticateApiKey(['service'])(req, res, next);
};

module.exports = {
  auth: authenticateApiKey(['sdk', 'service']),
  authSdk: authenticateApiKey(['sdk', 'service']),
  authControlPlane: authenticateControlPlane,
  authUser: authenticateUser
};
