'use strict';

const crypto = require('crypto');
const { promisify } = require('util');

const pbkdf2 = promisify(crypto.pbkdf2);
const PASSWORD_HASH_ITERATIONS = 210000;
const PASSWORD_HASH_KEY_LENGTH = 64;
const PASSWORD_HASH_DIGEST = 'sha512';

/**
 * Hashes password using PBKDF2 with a secure salt.
 * @param {string} password 
 * @returns {Promise<string>} The formatted hash string: pbkdf2$iterations$salt$hash
 */
const hashPassword = async (password) => {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = await pbkdf2(password, salt, PASSWORD_HASH_ITERATIONS, PASSWORD_HASH_KEY_LENGTH, PASSWORD_HASH_DIGEST);
  return `pbkdf2$${PASSWORD_HASH_ITERATIONS}$${salt}$${hash.toString('hex')}`;
};

/**
 * Verifies a password against a stored PBKDF2 formatted hash string.
 * @param {string} password 
 * @param {string} storedHash 
 * @returns {Promise<boolean>} True if matched, false otherwise
 */
const verifyPassword = async (password, storedHash) => {
  try {
    if (!storedHash || !storedHash.startsWith('pbkdf2$')) {
      return false;
    }
    const parts = storedHash.split('$');
    if (parts.length !== 3 && parts.length !== 4) {
      return false;
    }
    const [, maybeIterations, maybeSalt, maybeHash] = parts;
    const hasIterations = parts.length === 4;
    const iterations = hasIterations ? Number(maybeIterations) : 1000;
    const salt = hasIterations ? maybeSalt : maybeIterations;
    const hash = hasIterations ? maybeHash : maybeSalt;
    if (!Number.isSafeInteger(iterations) || iterations < 1 || !/^[a-f0-9]+$/i.test(hash)) {
      return false;
    }
    const expected = Buffer.from(hash, 'hex');
    const actual = await pbkdf2(password, salt, iterations, expected.length, PASSWORD_HASH_DIGEST);
    return expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
  } catch (err) {
    return false;
  }
};

module.exports = {
  hashPassword,
  verifyPassword,
  PASSWORD_HASH_ITERATIONS
};
