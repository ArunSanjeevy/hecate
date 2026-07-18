'use strict';

const crypto = require('crypto');
const JWT_SECRET = process.env.JWT_SECRET || 'hecate-jwt-secret-key-12345';

/**
 * Encodes string to base64url format
 */
const base64url = (value) => {
  return Buffer.from(value).toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_');
};

/**
 * Decodes base64url encoded string to UTF-8
 */
const base64urlDecode = (str) => {
  let base64 = str.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4) {
    base64 += '=';
  }
  return Buffer.from(base64, 'base64').toString('utf8');
};

/**
 * Signs a payload generating a stateless signed JWT
 * @param {object} payload 
 * @param {string} [secret] 
 * @param {string} [expiresIn] e.g. '24h'
 * @returns {string} The JWT string
 */
const sign = (payload, secret = JWT_SECRET, expiresIn = '24h') => {
  const header = { alg: 'HS256', typ: 'JWT' };
  const cleanPayload = { ...payload };

  const duration = typeof expiresIn === 'string' ? /^([1-9]\d*)([smhd])$/.exec(expiresIn) : null;
  const multipliers = { s: 1, m: 60, h: 3600, d: 86400 };
  const expiresInSeconds = duration ? Number(duration[1]) * multipliers[duration[2]] : 86400;
  cleanPayload.exp = Math.floor(Date.now() / 1000) + expiresInSeconds;

  const encodedHeader = base64url(JSON.stringify(header));
  const encodedPayload = base64url(JSON.stringify(cleanPayload));

  const signature = crypto.createHmac('sha256', secret)
    .update(`${encodedHeader}.${encodedPayload}`)
    .digest();

  const encodedSignature = base64url(signature);

  return `${encodedHeader}.${encodedPayload}.${encodedSignature}`;
};

/**
 * Verifies a JWT and returns the parsed payload if valid, otherwise null
 * @param {string} token 
 * @param {string} [secret] 
 * @returns {object|null}
 */
const verify = (token, secret = JWT_SECRET) => {
  try {
    if (!token) return null;
    const parts = token.split('.');
    if (parts.length !== 3) return null;

    const [encodedHeader, encodedPayload, encodedSignature] = parts;
    const header = JSON.parse(base64urlDecode(encodedHeader));
    if (header.alg !== 'HS256' || header.typ !== 'JWT') {
      return null;
    }

    const expectedSignature = crypto.createHmac('sha256', secret)
      .update(`${encodedHeader}.${encodedPayload}`)
      .digest();
    const actualSignature = Buffer.from(encodedSignature.replace(/-/g, '+').replace(/_/g, '/'), 'base64');
    if (actualSignature.length !== expectedSignature.length || !crypto.timingSafeEqual(actualSignature, expectedSignature)) return null;

    const payload = JSON.parse(base64urlDecode(encodedPayload));
    if (!Number.isFinite(payload.exp) || Date.now() / 1000 >= payload.exp) {
      return null; // Expired
    }

    return payload;
  } catch (err) {
    return null;
  }
};

module.exports = {
  sign,
  verify
};
