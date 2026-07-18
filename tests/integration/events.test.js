'use strict';

const request = require('supertest');
const app = require('../../app');
const { db } = require('../../lib/data-accessors/db');
const { disconnectRedis, flushAll } = require('../../lib/cache/redis');

describe('Event Tracking (Phases 3 & 4)', () => {
  beforeAll(async () => {
    const migrate = require('../../lib/helpers/migrate');
    await migrate();
  });

  beforeEach(async () => {
    await db.none('TRUNCATE TABLE experiments CASCADE');
    await db.none('TRUNCATE TABLE exposure_events CASCADE');
    await db.none('TRUNCATE TABLE telemetry_events CASCADE');
    await flushAll();

    // Create a base experiment for tests
    await request(app)
      .post('/api/v1/experiments')
      .set('x-api-key', 'dev-api-key')
      .send({
        key: 'checkout_button_text',
        status: 'active',
        variants: [
          { key: 'control', allocation: 50 },
          { key: 'treatment', allocation: 50 }
        ]
      })
      .expect(201);
  });

  afterAll(async () => {
    await db.$pool.end();
    await disconnectRedis();
  });

  describe('POST /api/v1/events/exposure', () => {
    const validExposure = {
      visitorId: 'visitor_123',
      experimentKey: 'checkout_button_text',
      variantKey: 'control',
      occurredAt: '2026-07-18T10:30:00.000Z',
      metadata: { page: 'checkout' }
    };

    it('should record first exposure event with deduped: false', async () => {
      const res = await request(app)
        .post('/api/v1/events/exposure')
        .set('x-api-key', 'dev-api-key')
        .send(validExposure)
        .expect(200);

      expect(res.body.status).toBe('success');
      expect(res.body.deduped).toBe(false);

      const row = await db.one('SELECT * FROM exposure_events WHERE visitor_id = $1', ['visitor_123']);
      expect(row.experiment_key).toBe('checkout_button_text');
      expect(row.variant_key).toBe('control');
      expect(row.metadata).toEqual({ page: 'checkout' });
      expect(new Date(row.occurred_at).toISOString()).toBe(validExposure.occurredAt);
    });

    it('should deduplicate subsequent identical exposure events with deduped: true', async () => {
      await request(app)
        .post('/api/v1/events/exposure')
        .set('x-api-key', 'dev-api-key')
        .send(validExposure)
        .expect(200);

      const res = await request(app)
        .post('/api/v1/events/exposure')
        .set('x-api-key', 'dev-api-key')
        .send(validExposure)
        .expect(200);

      expect(res.body.status).toBe('success');
      expect(res.body.deduped).toBe(true);

      const count = await db.one('SELECT count(*)::int FROM exposure_events');
      expect(count.count).toBe(1);
    });

    it('should reject invalid experiment keys with 404', async () => {
      const payload = { ...validExposure, experimentKey: 'unknown_key' };

      const res = await request(app)
        .post('/api/v1/events/exposure')
        .set('x-api-key', 'dev-api-key')
        .send(payload)
        .expect(404);

      expect(res.body.status).toBe('failed');
      expect(res.body.error_code).toBe('experiment_not_found');
    });

    it('should reject invalid variant keys with 400', async () => {
      const payload = { ...validExposure, variantKey: 'invalid_variant' };

      const res = await request(app)
        .post('/api/v1/events/exposure')
        .set('x-api-key', 'dev-api-key')
        .send(payload)
        .expect(400);

      expect(res.body.status).toBe('failed');
      expect(res.body.error_code).toBe('invalid_payload');
    });
  });

  describe('POST /api/v1/events/telemetry', () => {
    const validConversion = {
      visitorId: 'visitor_123',
      experimentKey: 'checkout_button_text',
      variantKey: 'control',
      eventType: 'conversion',
      eventName: 'order_placed',
      occurredAt: '2026-07-18T10:35:00.000Z',
      metadata: { orderValue: 129.99 }
    };

    const validGeneralEvent = {
      visitorId: 'visitor_123',
      experimentKey: 'checkout_button_text',
      variantKey: 'control',
      eventType: 'commerce',
      eventName: 'add_to_cart',
      metadata: { productId: 'sku_123' }
    };

    it('should record conversion events with deduped: false', async () => {
      const res = await request(app)
        .post('/api/v1/events/telemetry')
        .set('x-api-key', 'dev-api-key')
        .send(validConversion)
        .expect(200);

      expect(res.body.status).toBe('success');
      expect(res.body.deduped).toBe(false);

      const row = await db.one('SELECT * FROM telemetry_events WHERE visitor_id = $1 AND event_type = $2', ['visitor_123', 'conversion']);
      expect(row.event_name).toBe('order_placed');
      expect(row.metadata).toEqual({ orderValue: 129.99 });
    });

    it('should deduplicate conversion events with identical names with deduped: true', async () => {
      await request(app)
        .post('/api/v1/events/telemetry')
        .set('x-api-key', 'dev-api-key')
        .send(validConversion)
        .expect(200);

      const res = await request(app)
        .post('/api/v1/events/telemetry')
        .set('x-api-key', 'dev-api-key')
        .send(validConversion)
        .expect(200);

      expect(res.body.status).toBe('success');
      expect(res.body.deduped).toBe(true);

      const count = await db.one('SELECT count(*)::int FROM telemetry_events WHERE event_type = $1', ['conversion']);
      expect(count.count).toBe(1);
    });

    it('should store different conversion event names independently with deduped: false', async () => {
      await request(app)
        .post('/api/v1/events/telemetry')
        .set('x-api-key', 'dev-api-key')
        .send(validConversion)
        .expect(200);

      const secondConversion = { ...validConversion, eventName: 'signup_completed' };
      const res = await request(app)
        .post('/api/v1/events/telemetry')
        .set('x-api-key', 'dev-api-key')
        .send(secondConversion)
        .expect(200);

      expect(res.body.status).toBe('success');
      expect(res.body.deduped).toBe(false);

      const count = await db.one('SELECT count(*)::int FROM telemetry_events WHERE event_type = $1', ['conversion']);
      expect(count.count).toBe(2);
    });

    it('should store non-conversion events independently without applying deduplication', async () => {
      const res1 = await request(app)
        .post('/api/v1/events/telemetry')
        .set('x-api-key', 'dev-api-key')
        .send(validGeneralEvent)
        .expect(200);

      expect(res1.body.deduped).toBe(false);

      const res2 = await request(app)
        .post('/api/v1/events/telemetry')
        .set('x-api-key', 'dev-api-key')
        .send(validGeneralEvent)
        .expect(200);

      expect(res2.body.deduped).toBe(false);

      const count = await db.one('SELECT count(*)::int FROM telemetry_events WHERE event_type = $1', ['commerce']);
      expect(count.count).toBe(2);
    });
  });
});
