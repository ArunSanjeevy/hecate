'use strict';

const request = require('supertest');
const app = require('../../app');
const { db } = require('../../lib/data-accessors/db');
const { disconnectRedis, flushAll } = require('../../lib/cache/redis');

describe('Experiment CRUD (Phase 1)', () => {
  beforeAll(async () => {
    const migrate = require('../../lib/helpers/migrate');
    await migrate();
  });

  beforeEach(async () => {
    // Clean database before each test
    await db.none('TRUNCATE TABLE experiments CASCADE');
    // Clear Redis cache
    await flushAll();
  });

  afterAll(async () => {
    // Close connection pools to let tests exit cleanly
    await db.$pool.end();
    await disconnectRedis();
  });

  const validExperiment = {
    key: 'checkout_button_text',
    status: 'active',
    variants: [
      { key: 'control', allocation: 50 },
      { key: 'treatment', allocation: 50 }
    ]
  };

  describe('POST /api/v1/experiments', () => {
    it('should create an experiment successfully', async () => {
      const res = await request(app)
        .post('/api/v1/experiments')
        .set('x-api-key', 'dev-api-key')
        .send(validExperiment)
        .expect('Content-Type', /json/)
        .expect(201);

      expect(res.body.status).toBe('success');
      expect(res.body.experiment.key).toBe('checkout_button_text');
      expect(res.body.experiment.status).toBe('active');
      expect(res.body.experiment.salt).toBe('v1');
      expect(res.body.experiment.variants).toEqual(validExperiment.variants);

      // Verify stored in PostgreSQL
      const dbRow = await db.one('SELECT * FROM experiments WHERE key = $1', ['checkout_button_text']);
      expect(dbRow.status).toBe('active');
      expect(dbRow.variants).toEqual(validExperiment.variants);
    });

    it('should reject duplicate experiment keys', async () => {
      // First insert
      await request(app)
        .post('/api/v1/experiments')
        .set('x-api-key', 'dev-api-key')
        .send(validExperiment)
        .expect(201);

      // Duplicate insert
      const res = await request(app)
        .post('/api/v1/experiments')
        .set('x-api-key', 'dev-api-key')
        .send(validExperiment)
        .expect(409);

      expect(res.body.status).toBe('failed');
      expect(res.body.error_code).toBe('duplicate_experiment_key');
    });

    it('should reject fewer than two variants', async () => {
      const payload = {
        key: 'checkout_button_text',
        status: 'active',
        variants: [{ key: 'control', allocation: 100 }]
      };

      const res = await request(app)
        .post('/api/v1/experiments')
        .set('x-api-key', 'dev-api-key')
        .send(payload)
        .expect(400);

      expect(res.body.status).toBe('failed');
      expect(res.body.error_code).toBe('invalid_payload');
      expect(res.body.message).toContain('at least two variants');
    });

    it('should reject duplicate variant keys', async () => {
      const payload = {
        key: 'checkout_button_text',
        status: 'active',
        variants: [
          { key: 'control', allocation: 50 },
          { key: 'control', allocation: 50 }
        ]
      };

      const res = await request(app)
        .post('/api/v1/experiments')
        .set('x-api-key', 'dev-api-key')
        .send(payload)
        .expect(400);

      expect(res.body.status).toBe('failed');
      expect(res.body.error_code).toBe('invalid_payload');
      expect(res.body.message).toContain('keys must be unique');
    });

    it('should reject allocations that do not total 100', async () => {
      const payload = {
        key: 'checkout_button_text',
        status: 'active',
        variants: [
          { key: 'control', allocation: 50 },
          { key: 'treatment', allocation: 40 }
        ]
      };

      const res = await request(app)
        .post('/api/v1/experiments')
        .set('x-api-key', 'dev-api-key')
        .send(payload)
        .expect(400);

      expect(res.body.status).toBe('failed');
      expect(res.body.error_code).toBe('invalid_payload');
      expect(res.body.message).toContain('total exactly 100');
    });
  });

  describe('GET /api/v1/experiments/:key', () => {
    it('should return experiment details directly', async () => {
      // Create first
      await request(app)
        .post('/api/v1/experiments')
        .set('x-api-key', 'dev-api-key')
        .send(validExperiment)
        .expect(201);

      const res = await request(app)
        .get('/api/v1/experiments/checkout_button_text')
        .set('x-api-key', 'dev-api-key')
        .expect(200);

      expect(res.body.key).toBe('checkout_button_text');
      expect(res.body.status).toBe('active');
      expect(res.body.variants).toEqual(validExperiment.variants);
    });

    it('should return 404 for unknown experiment key', async () => {
      const res = await request(app)
        .get('/api/v1/experiments/unknown_key')
        .set('x-api-key', 'dev-api-key')
        .expect(404);

      expect(res.body.status).toBe('failed');
      expect(res.body.error_code).toBe('experiment_not_found');
    });
  });

  describe('PUT /api/v1/experiments/:key', () => {
    it('should update status and allocation successfully', async () => {
      // Create first
      await request(app)
        .post('/api/v1/experiments')
        .set('x-api-key', 'dev-api-key')
        .send(validExperiment)
        .expect(201);

      const updatedPayload = {
        status: 'paused',
        variants: [
          { key: 'control', allocation: 90 },
          { key: 'treatment', allocation: 10 }
        ]
      };

      const res = await request(app)
        .put('/api/v1/experiments/checkout_button_text')
        .set('x-api-key', 'dev-api-key')
        .send(updatedPayload)
        .expect(200);

      expect(res.body.status).toBe('success');
      expect(res.body.experiment.status).toBe('paused');
      expect(res.body.experiment.variants).toEqual(updatedPayload.variants);
    });

    it('should return 404 when updating unknown experiment', async () => {
      const updatedPayload = {
        status: 'paused',
        variants: [
          { key: 'control', allocation: 90 },
          { key: 'treatment', allocation: 10 }
        ]
      };

      const res = await request(app)
        .put('/api/v1/experiments/unknown_key')
        .set('x-api-key', 'dev-api-key')
        .send(updatedPayload)
        .expect(404);

      expect(res.body.status).toBe('failed');
      expect(res.body.error_code).toBe('experiment_not_found');
    });
  });

  describe('GET /api/v1/experiments', () => {
    it('should list all experiments successfully', async () => {
      await request(app)
        .post('/api/v1/experiments')
        .set('x-api-key', 'dev-api-key')
        .send(validExperiment)
        .expect(201);

      await request(app)
        .post('/api/v1/experiments')
        .set('x-api-key', 'dev-api-key')
        .send({
          key: 'homepage_hero',
          status: 'active',
          variants: [
            { key: 'control', allocation: 50 },
            { key: 'treatment', allocation: 50 }
          ]
        })
        .expect(201);

      const res = await request(app)
        .get('/api/v1/experiments')
        .set('x-api-key', 'dev-api-key')
        .expect(200);

      expect(res.body.experiments).toBeDefined();
      expect(res.body.experiments.length).toBe(2);

      const keys = res.body.experiments.map(e => e.key);
      expect(keys).toContain('checkout_button_text');
      expect(keys).toContain('homepage_hero');
    });
  });

  describe('POST /api/v1/experiments/:key/activate', () => {
    it('should activate a paused experiment', async () => {
      // Create paused experiment
      await request(app)
        .post('/api/v1/experiments')
        .set('x-api-key', 'dev-api-key')
        .send({
          key: 'activate_test',
          status: 'paused',
          variants: [
            { key: 'control', allocation: 50 },
            { key: 'treatment', allocation: 50 }
          ]
        })
        .expect(201);

      const res = await request(app)
        .post('/api/v1/experiments/activate_test/activate')
        .set('x-api-key', 'dev-api-key')
        .expect(200);

      expect(res.body.status).toBe('success');
      expect(res.body.experiment.status).toBe('active');

      // Verify db is updated
      const row = await db.one('SELECT status FROM experiments WHERE key = $1', ['activate_test']);
      expect(row.status).toBe('active');
    });

    it('should return 404 for activating unknown experiment', async () => {
      await request(app)
        .post('/api/v1/experiments/unknown_key/activate')
        .set('x-api-key', 'dev-api-key')
        .expect(404);
    });
  });

  describe('POST /api/v1/experiments/:key/deactivate', () => {
    it('should deactivate an active experiment', async () => {
      await request(app)
        .post('/api/v1/experiments')
        .set('x-api-key', 'dev-api-key')
        .send(validExperiment)
        .expect(201);

      const res = await request(app)
        .post('/api/v1/experiments/checkout_button_text/deactivate')
        .set('x-api-key', 'dev-api-key')
        .expect(200);

      expect(res.body.status).toBe('success');
      expect(res.body.experiment.status).toBe('paused');

      // Verify db is updated
      const row = await db.one('SELECT status FROM experiments WHERE key = $1', ['checkout_button_text']);
      expect(row.status).toBe('paused');
    });
  });

  describe('DELETE /api/v1/experiments/:key', () => {
    it('should delete an experiment successfully', async () => {
      await request(app)
        .post('/api/v1/experiments')
        .set('x-api-key', 'dev-api-key')
        .send(validExperiment)
        .expect(201);

      const res = await request(app)
        .delete('/api/v1/experiments/checkout_button_text')
        .set('x-api-key', 'dev-api-key')
        .expect(200);

      expect(res.body.status).toBe('success');
      expect(res.body.message).toBe('Experiment deleted successfully');

      // Verify db is empty
      const row = await db.oneOrNone('SELECT * FROM experiments WHERE key = $1', ['checkout_button_text']);
      expect(row).toBeNull();
    });

    it('should return 404 when deleting unknown experiment', async () => {
      await request(app)
        .delete('/api/v1/experiments/unknown_key')
        .set('x-api-key', 'dev-api-key')
        .expect(404);
    });
  });
});
