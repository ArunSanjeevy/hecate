'use strict';

const request = require('supertest');
const app = require('../../app');
const { db } = require('../../lib/data-accessors/db');
const { disconnectRedis } = require('../../lib/cache/redis');
const { ensureTestServiceKey } = require('./test-auth-helper');
const { assertSafeTestDatabase } = require('./test-db-helper');

describe('Service Foundation (Phase 0)', () => {
  beforeAll(async () => {
    await assertSafeTestDatabase();
    const migrate = require('../../lib/helpers/migrate');
    await migrate();
    await ensureTestServiceKey();
  });

  afterAll(async () => {
    // Close connection pools to let tests exit cleanly
    await db.$pool.end();
    await disconnectRedis();
  });

  describe('GET /health', () => {
    it('should return 200 and status ok', async () => {
      const res = await request(app)
        .get('/health')
        .expect('Content-Type', /json/)
        .expect(200);

      expect(res.body).toEqual({ status: 'ok' });
    });
  });

  describe('API Key Authentication', () => {
    it('should reject requests with missing API key with 401', async () => {
      const res = await request(app)
        .get('/api/v1/experiments/some-key')
        .expect(401);

      expect(res.body.status).toBe('failed');
      expect(res.body.error_code).toBe('authentication_failed');
    });

    it('should reject requests with invalid API key with 401', async () => {
      const res = await request(app)
        .get('/api/v1/experiments/some-key')
        .set('x-api-key', 'wrong-key')
        .expect(401);

      expect(res.body.status).toBe('failed');
      expect(res.body.error_code).toBe('authentication_failed');
    });

    it('should accept requests with valid API key and pass authentication', async () => {
      const res = await request(app)
        .get('/api/v1/experiments/some-key')
        .set('x-api-key', 'dev-api-key');

      // Passes auth, falls through to 404 experiment_not_found since key doesn't exist
      expect(res.status).toBe(404);
      expect(res.body.error_code).toBe('experiment_not_found');
    });
  });
});
