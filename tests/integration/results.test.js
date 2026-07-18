'use strict';

const request = require('supertest');
const app = require('../../app');
const { db } = require('../../lib/data-accessors/db');
const { disconnectRedis, flushAll } = require('../../lib/cache/redis');
const { assignVariant } = require('../../lib/helpers/assignment-engine');

describe('Results API (Phase 5)', () => {
  const experiment = {
    key: 'checkout_button_text',
    status: 'active',
    variants: [{ key: 'control', allocation: 50 }, { key: 'treatment', allocation: 50 }]
  };
  const variantFor = visitorId => assignVariant(visitorId, experiment);
  beforeAll(async () => {
    const migrate = require('../../lib/helpers/migrate');
    await migrate();
  });

  beforeEach(async () => {
    await db.none('TRUNCATE TABLE experiments CASCADE');
    await db.none('TRUNCATE TABLE exposure_events CASCADE');
    await db.none('TRUNCATE TABLE telemetry_events CASCADE');
    await flushAll();

    // Create experiment
    await request(app)
      .post('/api/v1/experiments')
      .set('x-api-key', 'dev-api-key')
      .send(experiment)
      .expect(201);
  });

  afterAll(async () => {
    await db.$pool.end();
    await disconnectRedis();
  });

  describe('GET /api/v1/results/:experimentKey', () => {
    it('should aggregate exposures and conversions correctly', async () => {
      // 1. Log exposures
      for (const visitorId of ['visitor1', 'visitor2', 'visitor3']) {
        await request(app).post('/api/v1/events/exposure').set('x-api-key', 'dev-api-key').send({
          visitorId, experimentKey: experiment.key, variantKey: variantFor(visitorId)
        }).expect(200);
      }

      // 2. Log conversions
      await request(app).post('/api/v1/events/telemetry').set('x-api-key', 'dev-api-key').send({
        visitorId: 'visitor1', experimentKey: 'checkout_button_text',
        eventType: 'conversion', eventName: 'order_placed'
      }).expect(200);

      await request(app).post('/api/v1/events/telemetry').set('x-api-key', 'dev-api-key').send({
        visitorId: 'visitor2', experimentKey: 'checkout_button_text',
        eventType: 'conversion', eventName: 'order_placed'
      }).expect(200);

      // visitor4 converts without an exposure and is rejected before results.
      await request(app).post('/api/v1/events/telemetry').set('x-api-key', 'dev-api-key').send({
        visitorId: 'visitor4', experimentKey: 'checkout_button_text', eventType: 'conversion', eventName: 'order_placed'
      }).expect(409);

      // 3. Get results
      const res = await request(app)
        .get('/api/v1/results/checkout_button_text')
        .set('x-api-key', 'dev-api-key')
        .expect(200);

      expect(res.body.experimentKey).toBe('checkout_button_text');
      expect(res.body.variants.length).toBe(2);

      for (const variantKey of ['control', 'treatment']) {
        const expectedExposures = ['visitor1', 'visitor2', 'visitor3'].filter(visitorId => variantFor(visitorId) === variantKey).length;
        const expectedConversions = ['visitor1', 'visitor2'].filter(visitorId => variantFor(visitorId) === variantKey).length;
        const result = res.body.variants.find(v => v.variantKey === variantKey);
        expect(result.exposures).toBe(expectedExposures);
        expect(result.conversions).toBe(expectedConversions);
        expect(result.conversionRate).toBe(expectedExposures ? expectedConversions / expectedExposures : 0);
      }
    });

    it('should handle duplicate events without inflating counts', async () => {
      await request(app).post('/api/v1/events/exposure').set('x-api-key', 'dev-api-key').send({
        visitorId: 'visitor1', experimentKey: 'checkout_button_text', variantKey: variantFor('visitor1')
      });
      await request(app).post('/api/v1/events/exposure').set('x-api-key', 'dev-api-key').send({
        visitorId: 'visitor1', experimentKey: 'checkout_button_text', variantKey: variantFor('visitor1')
      });

      await request(app).post('/api/v1/events/telemetry').set('x-api-key', 'dev-api-key').send({
        visitorId: 'visitor1', experimentKey: 'checkout_button_text',
        eventType: 'conversion', eventName: 'order_placed'
      });
      await request(app).post('/api/v1/events/telemetry').set('x-api-key', 'dev-api-key').send({
        visitorId: 'visitor1', experimentKey: 'checkout_button_text',
        eventType: 'conversion', eventName: 'order_placed'
      });

      const res = await request(app)
        .get('/api/v1/results/checkout_button_text')
        .set('x-api-key', 'dev-api-key')
        .expect(200);

      const result = res.body.variants.find(v => v.variantKey === variantFor('visitor1'));
      expect(result.exposures).toBe(1);
      expect(result.conversions).toBe(1);
      expect(result.conversionRate).toBe(1.0);
    });

    it('should return zero exposures and zero conversions for fresh variants safely', async () => {
      const res = await request(app)
        .get('/api/v1/results/checkout_button_text')
        .set('x-api-key', 'dev-api-key')
        .expect(200);

      expect(res.body.variants.length).toBe(2);
      expect(res.body.variants[0].exposures).toBe(0);
      expect(res.body.variants[0].conversions).toBe(0);
      expect(res.body.variants[0].conversionRate).toBe(0);
    });

    it('should return 404 for unknown experiment results lookup', async () => {
      const res = await request(app)
        .get('/api/v1/results/unknown_key')
        .set('x-api-key', 'dev-api-key')
        .expect(404);

      expect(res.body.status).toBe('failed');
      expect(res.body.error_code).toBe('experiment_not_found');
    });
  });
});
