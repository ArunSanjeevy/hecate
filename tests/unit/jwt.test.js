'use strict';

describe('JWT helper', () => {
  const originalNodeEnv = process.env.NODE_ENV;
  const originalJwtSecret = process.env.JWT_SECRET;
  const originalJwtIssuer = process.env.JWT_ISSUER;
  const originalJwtAudience = process.env.JWT_AUDIENCE;
  const originalJwtExpiresIn = process.env.JWT_EXPIRES_IN;

  const restoreEnv = (key, value) => {
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  };

  const loadJwtHelper = () => {
    jest.resetModules();
    return require('../../lib/helpers/jwt');
  };

  afterEach(() => {
    restoreEnv('NODE_ENV', originalNodeEnv);
    restoreEnv('JWT_SECRET', originalJwtSecret);
    restoreEnv('JWT_ISSUER', originalJwtIssuer);
    restoreEnv('JWT_AUDIENCE', originalJwtAudience);
    restoreEnv('JWT_EXPIRES_IN', originalJwtExpiresIn);
    jest.resetModules();
  });

  it('signs and verifies dashboard tokens with standard claims', () => {
    process.env.NODE_ENV = 'test';
    process.env.JWT_SECRET = 'unit-test-jwt-secret-with-at-least-32-chars';
    process.env.JWT_ISSUER = 'hecate-api';
    process.env.JWT_AUDIENCE = 'hecate-dashboard';

    const jwtHelper = loadJwtHelper();
    const token = jwtHelper.sign({ userId: 'user-123', email: 'owner@example.com' });
    const payload = jwtHelper.verify(token);

    expect(payload.sub).toBe('user-123');
    expect(payload.userId).toBe('user-123');
    expect(payload.email).toBe('owner@example.com');
    expect(payload.iss).toBe('hecate-api');
    expect(payload.aud).toBe('hecate-dashboard');
    expect(payload.iat).toEqual(expect.any(Number));
    expect(payload.exp).toEqual(expect.any(Number));
  });

  it('rejects tokens for a different audience', () => {
    process.env.NODE_ENV = 'test';
    process.env.JWT_SECRET = 'unit-test-jwt-secret-with-at-least-32-chars';
    process.env.JWT_AUDIENCE = 'hecate-dashboard';

    const jwtHelper = loadJwtHelper();
    const token = jwtHelper.sign({ userId: 'user-123' });

    process.env.JWT_AUDIENCE = 'another-dashboard';

    expect(jwtHelper.verify(token)).toBeNull();
  });

  it('requires JWT_SECRET outside tests', () => {
    process.env.NODE_ENV = 'prod';
    delete process.env.JWT_SECRET;

    expect(loadJwtHelper).toThrow('JWT_SECRET is required');
  });

  it('rejects weak JWT secrets', () => {
    process.env.NODE_ENV = 'prod';
    process.env.JWT_SECRET = 'too-short';

    expect(loadJwtHelper).toThrow('JWT_SECRET must be at least 32 characters');
  });
});
