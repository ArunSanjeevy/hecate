'use strict';

const {
  parseBoolean,
  parsePositiveInteger,
  parseStringList,
  validateProductionConfig
} = require('../../lib/helpers/config-utils');

describe('config utilities', () => {
  it('parses booleans with defaults', () => {
    expect(parseBoolean(undefined, true)).toBe(true);
    expect(parseBoolean('true', false)).toBe(true);
    expect(parseBoolean('false', true)).toBe(false);
  });

  it('parses positive integers with defaults', () => {
    expect(parsePositiveInteger(undefined, 10)).toBe(10);
    expect(parsePositiveInteger('25', 10)).toBe(25);
    expect(() => parsePositiveInteger('0', 10)).toThrow('Expected a positive integer');
    expect(() => parsePositiveInteger('abc', 10)).toThrow('Expected a positive integer');
  });

  it('parses comma-separated string lists', () => {
    expect(parseStringList(undefined, ['*'])).toEqual(['*']);
    expect(parseStringList('https://app.example.com, https://admin.example.com')).toEqual([
      'https://app.example.com',
      'https://admin.example.com'
    ]);
  });

  it('rejects incomplete production configuration', () => {
    expect(() => validateProductionConfig({
      env: 'prod',
      postgres: { connectionString: 'postgres://user:pass@example.com:5432/db', ssl: { enabled: true, rejectUnauthorized: true, ca: 'cert' } },
      redis: { url: '' },
      jwt: { secret: 'a'.repeat(32) },
      apiKeyHash: { secret: 'b'.repeat(32) },
      cors: { origins: ['https://admin.example.com'] }
    })).toThrow('REDIS_URL is required');
  });

  it('accepts complete production configuration', () => {
    expect(() => validateProductionConfig({
      env: 'prod',
      postgres: { connectionString: 'postgres://user:pass@example.com:5432/db', ssl: { enabled: true, rejectUnauthorized: true, ca: 'cert' } },
      redis: { url: 'rediss://default:pass@example.com:6379' },
      jwt: { secret: 'a'.repeat(32) },
      apiKeyHash: { secret: 'b'.repeat(32) },
      cors: { origins: ['https://admin.example.com'] }
    })).not.toThrow();
  });
});
