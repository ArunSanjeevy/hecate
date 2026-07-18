'use strict';

const { db } = require('./db');
const Constants = require('../constants/Constants');

class EventsAccessor {
  async recordExposure(eventData) {
    const { experimentKey, visitorId, variantKey, occurredAt, metadata } = eventData;
    const query = `
      INSERT INTO ${Constants.Tables.ExposureEvents} (experiment_key, visitor_id, variant_key, occurred_at, metadata)
      VALUES ($1, $2, $3, COALESCE($4::timestamptz, CURRENT_TIMESTAMP), $5:json)
      ON CONFLICT (experiment_key, visitor_id, variant_key) DO NOTHING
      RETURNING id
    `;
    const result = await db.oneOrNone(query, [
      experimentKey,
      visitorId,
      variantKey,
      occurredAt,
      metadata
    ]);
    return result;
  }

  async recordTelemetry(eventData) {
    const { experimentKey, visitorId, variantKey, eventType, eventName, occurredAt, metadata } = eventData;
    
    if (eventType === Constants.EventTypes.Conversion) {
      const query = `
        INSERT INTO ${Constants.Tables.TelemetryEvents} (experiment_key, visitor_id, variant_key, event_type, event_name, occurred_at, metadata)
        VALUES ($1, $2, $3, $4, $5, COALESCE($6::timestamptz, CURRENT_TIMESTAMP), $7:json)
        ON CONFLICT (event_type, event_name, experiment_key, visitor_id) WHERE event_type = 'conversion' DO NOTHING
        RETURNING id
      `;
      const result = await db.oneOrNone(query, [
        experimentKey,
        visitorId,
        variantKey,
        eventType,
        eventName,
        occurredAt,
        metadata
      ]);
      return result;
    } else {
      const query = `
        INSERT INTO ${Constants.Tables.TelemetryEvents} (experiment_key, visitor_id, variant_key, event_type, event_name, occurred_at, metadata)
        VALUES ($1, $2, $3, $4, $5, COALESCE($6::timestamptz, CURRENT_TIMESTAMP), $7:json)
        RETURNING id
      `;
      const result = await db.one(query, [
        experimentKey,
        visitorId,
        variantKey,
        eventType,
        eventName,
        occurredAt,
        metadata
      ]);
      return result;
    }
  }
}

module.exports = new EventsAccessor();
