'use strict';

const request = require('supertest');
const app = require('../../app');
const { db } = require('../../lib/data-accessors/db');
const { disconnectRedis, flushAll } = require('../../lib/cache/redis');
const redisCache = require('../../lib/cache/redis');

describe('Deterministic Assignment (Phase 2)', () => {
  beforeAll(async () => {
    const migrate = require('../../lib/helpers/migrate');
    await migrate();
  });

  beforeEach(async () => {
    await db.none('TRUNCATE TABLE experiments CASCADE');
    await db.none('TRUNCATE TABLE exposure_events CASCADE');
    await db.none('TRUNCATE TABLE telemetry_events CASCADE');
    await flushAll();
  });

  afterAll(async () => {
    await db.$pool.end();
    await disconnectRedis();
  });

  const experiment1 = {
    key: 'homepage_hero',
    status: 'active',
    variants: [
      { key: 'control', allocation: 50 },
      { key: 'treatment', allocation: 50 }
    ]
  };

  const experiment2 = {
    key: 'checkout_button_text',
    status: 'active',
    variants: [
      { key: 'control', allocation: 90 },
      { key: 'treatment', allocation: 10 }
    ]
  };

  const createExperiments = async () => {
    await request(app)
      .post('/api/v1/experiments')
      .set('x-api-key', 'dev-api-key')
      .send(experiment1)
      .expect(201);

    await request(app)
      .post('/api/v1/experiments')
      .set('x-api-key', 'dev-api-key')
      .send(experiment2)
      .expect(201);
  };

  describe('POST /api/v1/assignments', () => {
    it('should assign a visitor deterministically and stickily', async () => {
      await createExperiments();

      const makeRequest = () => request(app)
        .post('/api/v1/assignments')
        .set('x-api-key', 'dev-api-key')
        .send({
          visitorId: 'visitor_abc',
          experimentKeys: ['homepage_hero', 'checkout_button_text']
        })
        .expect(200);

      const res1 = await makeRequest();
      const res2 = await makeRequest();

      expect(res1.body.assignments).toEqual(res2.body.assignments);
      expect(res1.body.assignments.length).toBe(2);

      const homepageHeroAssignment = res1.body.assignments.find(a => a.experimentKey === 'homepage_hero');
      expect(homepageHeroAssignment).toBeDefined();
      expect(['control', 'treatment']).toContain(homepageHeroAssignment.variantKey);
    });

    it('should assign variants correctly mapping to boundaries', async () => {
      const splitExperiment = {
        key: 'split_test',
        status: 'active',
        variants: [
          { key: 'v1', allocation: 10 },
          { key: 'v2', allocation: 90 }
        ]
      };

      await request(app)
        .post('/api/v1/experiments')
        .set('x-api-key', 'dev-api-key')
        .send(splitExperiment)
        .expect(201);

      const assignments = [];
      for (let i = 0; i < 50; i++) {
        const res = await request(app)
          .post('/api/v1/assignments')
          .set('x-api-key', 'dev-api-key')
          .send({
            visitorId: `visitor_${i}`,
            experimentKeys: ['split_test']
          })
          .expect(200);
        
        expect(res.body.assignments.length).toBe(1);
        expect(['v1', 'v2']).toContain(res.body.assignments[0].variantKey);
        assignments.push(res.body.assignments[0].variantKey);
      }

      const v1Count = assignments.filter(v => v === 'v1').length;
      const v2Count = assignments.filter(v => v === 'v2').length;
      expect(v1Count + v2Count).toBe(50);
      expect(v2Count).toBeGreaterThan(v1Count);
    }, 15000);

    it('should return errors for missing or inactive experiments', async () => {
      await createExperiments();

      await request(app)
        .post('/api/v1/experiments/checkout_button_text/deactivate')
        .set('x-api-key', 'dev-api-key')
        .expect(200);

      const res = await request(app)
        .post('/api/v1/assignments')
        .set('x-api-key', 'dev-api-key')
        .send({
          visitorId: 'visitor_123',
          experimentKeys: ['homepage_hero', 'checkout_button_text', 'unknown_experiment']
        })
        .expect(200);

      expect(res.body.assignments.length).toBe(1);
      expect(res.body.assignments[0].experimentKey).toBe('homepage_hero');

      expect(res.body.errors).toBeDefined();
      expect(res.body.errors.length).toBe(2);

      const pausedError = res.body.errors.find(e => e.experimentKey === 'checkout_button_text');
      expect(pausedError.reason).toBe('experiment_not_active');

      const missingError = res.body.errors.find(e => e.experimentKey === 'unknown_experiment');
      expect(missingError.reason).toBe('experiment_not_found');
    });

    it('should not write any rows to PostgreSQL during assignment', async () => {
      await createExperiments();

      const initialExposures = await db.one('SELECT count(*)::int FROM exposure_events');
      expect(initialExposures.count).toBe(0);

      await request(app)
        .post('/api/v1/assignments')
        .set('x-api-key', 'dev-api-key')
        .send({
          visitorId: 'visitor_123',
          experimentKeys: ['homepage_hero']
        })
        .expect(200);

      const finalExposures = await db.one('SELECT count(*)::int FROM exposure_events');
      expect(finalExposures.count).toBe(0);
    });

    it('should fallback to database when Redis cache fails or is down', async () => {
      await createExperiments();
      await flushAll();

      const originalGet = redisCache.get;
      redisCache.get = async () => {
        throw new Error('Redis connection lost');
      };

      try {
        const res = await request(app)
          .post('/api/v1/assignments')
          .set('x-api-key', 'dev-api-key')
          .send({
            visitorId: 'visitor_123',
            experimentKeys: ['homepage_hero']
          })
          .expect(200);

        expect(res.body.assignments.length).toBe(1);
        expect(res.body.assignments[0].experimentKey).toBe('homepage_hero');
        expect(res.body.errors).toBeUndefined();
      } finally {
        redisCache.get = originalGet;
      }
    });
  });
});
