'use strict';

const crypto = require('crypto');

/**
 * Hashes password using PBKDF2 with a secure salt.
 * @param {string} password 
 * @returns {string} The formatted hash string: pbkdf2$iterations$salt$hash
 */
const hashPassword = (password) => {
  const iterations = 210000;
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.pbkdf2Sync(password, salt, iterations, 64, 'sha512').toString('hex');
  return `pbkdf2$${iterations}$${salt}$${hash}`;
};

/**
 * Verifies a password against a stored PBKDF2 formatted hash string.
 * @param {string} password 
 * @param {string} storedHash 
 * @returns {boolean} True if matched, false otherwise
 */
const verifyPassword = (password, storedHash) => {
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
    const actual = crypto.pbkdf2Sync(password, salt, iterations, expected.length, 'sha512');
    return expected.length === actual.length && crypto.timingSafeEqual(expected, actual);
  } catch (err) {
    return false;
  }
};

module.exports = {
  hashPassword,
  verifyPassword
};
