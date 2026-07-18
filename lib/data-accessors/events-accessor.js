'use strict';

const { db } = require('./db');
const Constants = require('../constants/Constants');

class EventsAccessor {
  async recordExposure(eventData) {
    const { experimentKey, visitorId, variantKey, occurredAt, metadata } = eventData;
    const query = `
      INSERT INTO ${Constants.Tables.ExposureEvents} (experiment_key, visitor_id, variant_key, occurred_at, metadata)
      VALUES ($1, $2, $3, COALESCE($4::timestamptz, CURRENT_TIMESTAMP), $5:json)
      ON CONFLICT DO NOTHING
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

  async recordConversionFromVerifiedExposure(eventData) {
    const { experimentKey, visitorId, eventName, occurredAt, metadata } = eventData;
    const query = `
      WITH verified_exposure AS (
        SELECT variant_key
        FROM ${Constants.Tables.ExposureEvents}
        WHERE experiment_key = $1 AND visitor_id = $2
      ), inserted AS (
        INSERT INTO ${Constants.Tables.TelemetryEvents} (experiment_key, visitor_id, variant_key, event_type, event_name, occurred_at, metadata)
        SELECT $1, $2, variant_key, $3, $4, COALESCE($5::timestamptz, CURRENT_TIMESTAMP), $6:json
        FROM verified_exposure
        ON CONFLICT (event_type, event_name, experiment_key, visitor_id) WHERE event_type = 'conversion' DO NOTHING
        RETURNING id
      )
      SELECT EXISTS(SELECT 1 FROM verified_exposure) AS exposure_found,
             EXISTS(SELECT 1 FROM inserted) AS inserted
    `;
    return await db.one(query, [
      experimentKey,
      visitorId,
      Constants.EventTypes.Conversion,
      eventName,
      occurredAt,
      metadata
    ]);
  }
}

module.exports = new EventsAccessor();
