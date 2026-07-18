'use strict';

const eventsAccessor = require('../data-accessors/events-accessor');
const experimentsAccessor = require('../data-accessors/experiments-accessor');
const redisCache = require('../cache/redis');
const { exposureEventSchema, telemetryEventSchema } = require('../helpers/validation');
const Errors = require('../constants/Errors');
const logger = require('../helpers/logger');

class EventsController {
  async _validateExperimentAndVariant(experimentKey, variantKey) {
    const cacheKey = `experiment:${experimentKey}`;
    let experiment = null;

    try {
      experiment = await redisCache.get(cacheKey);
    } catch (err) {
      logger.error('Redis lookup failure for event validation', { experimentKey, error: err.message });
    }

    if (!experiment) {
      experiment = await experimentsAccessor.getByKey(experimentKey);
      if (experiment) {
        redisCache.set(cacheKey, {
          key: experiment.key,
          status: experiment.status,
          salt: experiment.salt,
          variants: experiment.variants
        }).catch(err => logger.error('Cache set error', { error: err.message }));
      }
    }

    if (!experiment) {
      throw Errors.experiment_not_found;
    }

    const hasVariant = experiment.variants.some(v => v.key === variantKey);
    if (!hasVariant) {
      throw {
        status_code: 400,
        error_code: 'invalid_payload',
        error_message: `Variant '${variantKey}' does not exist for experiment '${experimentKey}'`
      };
    }
  }

  async recordExposure(payload) {
    const { error, value } = exposureEventSchema.validate(payload);
    if (error) {
      throw error;
    }

    const { experimentKey, visitorId, variantKey, occurredAt, metadata } = value;

    await this._validateExperimentAndVariant(experimentKey, variantKey);

    const result = await eventsAccessor.recordExposure({
      experimentKey,
      visitorId,
      variantKey,
      occurredAt,
      metadata
    });

    return {
      deduped: result === null
    };
  }

  async recordTelemetry(payload) {
    const { error, value } = telemetryEventSchema.validate(payload);
    if (error) {
      throw error;
    }

    const { experimentKey, visitorId, variantKey, eventType, eventName, occurredAt, metadata } = value;

    await this._validateExperimentAndVariant(experimentKey, variantKey);

    const result = await eventsAccessor.recordTelemetry({
      experimentKey,
      visitorId,
      variantKey,
      eventType,
      eventName,
      occurredAt,
      metadata
    });

    return {
      deduped: result === null
    };
  }
}

module.exports = new EventsController();
