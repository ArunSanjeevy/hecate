'use strict';

const crypto = require('crypto');
const usersAccessor = require('../data-accessors/users-accessor');
const keysAccessor = require('../data-accessors/keys-accessor');
const hashHelper = require('../helpers/hash');
const jwtHelper = require('../helpers/jwt');
const { signupSchema, loginSchema } = require('../helpers/validation');
const Errors = require('../constants/Errors');

class AuthController {
  async signup(payload) {
    const { error, value } = signupSchema.validate(payload);
    if (error) {
      throw error;
    }

    const { email, password } = value;
    const passwordHash = hashHelper.hashPassword(password);

    try {
      // 1. Create user
      const user = await usersAccessor.create({ email, passwordHash });

      // 2. Generate default API key
      const defaultKeyString = 'hk_' + crypto.randomBytes(24).toString('hex');
      const apiKey = await keysAccessor.create({
        userId: user.id,
        apiKey: defaultKeyString,
        name: 'Default SDK Key',
        keyType: 'sdk'
      });

      return {
        user: {
          id: user.id,
          email: user.email
        },
        apiKey: apiKey.api_key
      };
    } catch (err) {
      if (err.code === '23505') {
        throw Errors.duplicate_email;
      }
      throw err;
    }
  }

  async login(payload) {
    const { error, value } = loginSchema.validate(payload);
    if (error) {
      throw error;
    }

    const { email, password } = value;
    const user = await usersAccessor.getByEmail(email);
    if (!user) {
      throw Errors.invalid_credentials;
    }

    const isMatch = hashHelper.verifyPassword(password, user.password_hash);
    if (!isMatch) {
      throw Errors.invalid_credentials;
    }

    // Load active (unexpired) API keys
    const activeKeys = await keysAccessor.listByUserId(user.id);

    // Generate session JWT token
    const token = jwtHelper.sign({ userId: user.id, email: user.email });

    return {
      token,
      user: {
        id: user.id,
        email: user.email
      },
      apiKeys: activeKeys.map(k => ({
        id: k.id,
        name: k.name,
        type: k.key_type,
        apiKey: `${k.api_key.slice(0, 6)}${'*'.repeat(Math.max(0, k.api_key.length - 10))}${k.api_key.slice(-4)}`,
        expiresAt: k.expires_at,
        createdAt: k.created_at
      }))
    };
  }
}

module.exports = new AuthController();
