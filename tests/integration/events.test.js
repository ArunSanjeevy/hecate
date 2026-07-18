'use strict';

const request = require('supertest');
const app = require('../../app');
const { db } = require('../../lib/data-accessors/db');
const { disconnectRedis, flushAll } = require('../../lib/cache/redis');
const { assignVariant } = require('../../lib/helpers/assignment-engine');

describe('Event Tracking (Phase 12)', () => {
  const experiment = {
    key: 'checkout_button_text',
    status: 'active',
    variants: [
      { key: 'control', allocation: 50 },
      { key: 'treatment', allocation: 50 }
    ]
  };
  const assignedVariant = visitorId => assignVariant(visitorId, experiment);
  const exposureFor = visitorId => ({
    visitorId,
    experimentKey: experiment.key,
    variantKey: assignedVariant(visitorId),
    occurredAt: '2026-07-18T10:30:00.000Z',
    metadata: { page: 'checkout' }
  });

  beforeAll(async () => {
    const migrate = require('../../lib/helpers/migrate');
    await migrate();
  });

  beforeEach(async () => {
    await db.none('TRUNCATE TABLE experiments CASCADE');
    await db.none('TRUNCATE TABLE exposure_events CASCADE');
    await db.none('TRUNCATE TABLE telemetry_events CASCADE');
    await flushAll();
    await request(app).post('/api/v1/experiments').set('x-api-key', 'dev-api-key').send(experiment).expect(201);
  });

  afterAll(async () => {
    await db.$pool.end();
    await disconnectRedis();
  });

  describe('POST /api/v1/events/exposure', () => {
    it('stores a valid deterministic exposure and deduplicates it by experiment and visitor', async () => {
      const exposure = exposureFor('visitor_123');
      await request(app).post('/api/v1/events/exposure').set('x-api-key', 'dev-api-key').send(exposure).expect(200);
      const duplicate = await request(app).post('/api/v1/events/exposure').set('x-api-key', 'dev-api-key').send(exposure).expect(200);

      expect(duplicate.body).toMatchObject({ status: 'success', deduped: true });
      const rows = await db.any('SELECT visitor_id, variant_key FROM exposure_events WHERE visitor_id = $1', [exposure.visitorId]);
      expect(rows).toEqual([{ visitor_id: exposure.visitorId, variant_key: exposure.variantKey }]);
    });

    it('rejects a mismatched assigned variant without storing an exposure', async () => {
      const exposure = exposureFor('visitor_mismatch');
      const mismatchedVariant = exposure.variantKey === 'control' ? 'treatment' : 'control';
      const response = await request(app).post('/api/v1/events/exposure').set('x-api-key', 'dev-api-key').send({ ...exposure, variantKey: mismatchedVariant }).expect(409);

      expect(response.body).toMatchObject({ status: 'failed', error_code: 'assignment_mismatch' });
      const count = await db.one('SELECT count(*)::int FROM exposure_events WHERE visitor_id = $1', [exposure.visitorId]);
      expect(count.count).toBe(0);
    });

    it('rejects an unknown experiment and a variant not present in the experiment', async () => {
      const exposure = exposureFor('visitor_invalid');
      await request(app).post('/api/v1/events/exposure').set('x-api-key', 'dev-api-key').send({ ...exposure, experimentKey: 'unknown_key' }).expect(404);
      const response = await request(app).post('/api/v1/events/exposure').set('x-api-key', 'dev-api-key').send({ ...exposure, variantKey: 'invalid_variant' }).expect(400);
      expect(response.body.error_code).toBe('invalid_payload');
    });
  });

  describe('POST /api/v1/events/telemetry', () => {
    it('derives a conversion variant from a verified exposure and ignores a conflicting supplied variant', async () => {
      const exposure = exposureFor('visitor_conversion');
      await request(app).post('/api/v1/events/exposure').set('x-api-key', 'dev-api-key').send(exposure).expect(200);
      const conflictingVariant = exposure.variantKey === 'control' ? 'treatment' : 'control';
      const response = await request(app).post('/api/v1/events/telemetry').set('x-api-key', 'dev-api-key').send({
        visitorId: exposure.visitorId, experimentKey: experiment.key, variantKey: conflictingVariant,
        eventType: 'conversion', eventName: 'order_placed', metadata: { orderValue: 129.99 }
      }).expect(200);

      expect(response.body.deduped).toBe(false);
      const row = await db.one("SELECT variant_key FROM telemetry_events WHERE event_type = 'conversion'");
      expect(row.variant_key).toBe(exposure.variantKey);
    });

    it('rejects a conversion without a verified exposure and does not store it', async () => {
      const response = await request(app).post('/api/v1/events/telemetry').set('x-api-key', 'dev-api-key').send({
        visitorId: 'visitor_without_exposure', experimentKey: experiment.key,
        eventType: 'conversion', eventName: 'order_placed'
      }).expect(409);

      expect(response.body.error_code).toBe('exposure_not_found');
      const count = await db.one("SELECT count(*)::int FROM telemetry_events WHERE event_type = 'conversion'");
      expect(count.count).toBe(0);
    });

    it('deduplicates conversions by experiment, visitor, and event name', async () => {
      const exposure = exposureFor('visitor_dedupe');
      await request(app).post('/api/v1/events/exposure').set('x-api-key', 'dev-api-key').send(exposure).expect(200);
      const conversion = { visitorId: exposure.visitorId, experimentKey: experiment.key, eventType: 'conversion', eventName: 'order_placed' };
      await request(app).post('/api/v1/events/telemetry').set('x-api-key', 'dev-api-key').send(conversion).expect(200);
      const duplicate = await request(app).post('/api/v1/events/telemetry').set('x-api-key', 'dev-api-key').send(conversion).expect(200);
      expect(duplicate.body.deduped).toBe(true);
    });

    it('keeps the variant-key contract for non-conversion telemetry', async () => {
      const exposure = exposureFor('visitor_general');
      await request(app).post('/api/v1/events/telemetry').set('x-api-key', 'dev-api-key').send({
        visitorId: exposure.visitorId, experimentKey: experiment.key, variantKey: exposure.variantKey,
        eventType: 'commerce', eventName: 'add_to_cart'
      }).expect(200);
    });
  });
});
