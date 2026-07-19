'use strict';

const usersAccessor = require('../data-accessors/users-accessor');
const keysAccessor = require('../data-accessors/keys-accessor');
const hashHelper = require('../helpers/hash');
const jwtHelper = require('../helpers/jwt');
const apiKeyHelper = require('../helpers/api-key');
const { signupSchema, loginSchema } = require('../helpers/validation');
const Errors = require('../constants/Errors');

class AuthController {
  async signup(payload) {
    const { error, value } = signupSchema.validate(payload);
    if (error) {
      throw error;
    }

    const { email, password } = value;
    const passwordHash = await hashHelper.hashPassword(password);

    try {
      const user = await usersAccessor.create({ email, passwordHash });

      return {
        user: {
          id: user.id,
          email: user.email
        }
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

    const isMatch = await hashHelper.verifyPassword(password, user.password_hash);
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
        apiKey: apiKeyHelper.maskApiKeyPrefix(k.api_key_prefix),
        expiresAt: k.expires_at,
        createdAt: k.created_at
      }))
    };
  }
}

module.exports = new AuthController();
