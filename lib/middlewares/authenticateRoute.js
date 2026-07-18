'use strict';

const Errors = require('../constants/Errors');
const keysAccessor = require('../data-accessors/keys-accessor');
const jwtHelper = require('../helpers/jwt');

/**
 * Middleware to authenticate requests using API key (x-api-key header)
 */
const authenticateApiKey = (allowedKeyTypes) => async (req, res, next) => {
  try {
    const apiKey = req.headers['x-api-key'];
    if (!apiKey) {
      return next(Errors.authentication_failed);
    }

    const keyRecord = await keysAccessor.getByKey(apiKey, allowedKeyTypes);
    if (!keyRecord) {
      return next(Errors.authentication_failed);
    }

    // Check if expired
    if (keyRecord.expires_at && new Date(keyRecord.expires_at) < new Date()) {
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
      id: payload.userId,
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
