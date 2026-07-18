'use strict';

const eventsAccessor = require('../data-accessors/events-accessor');
const experimentsAccessor = require('../data-accessors/experiments-accessor');
const redisCache = require('../cache/redis');
const { exposureEventSchema, telemetryEventSchema } = require('../helpers/validation');
const Errors = require('../constants/Errors');
const logger = require('../helpers/logger');
const { assignVariant } = require('../helpers/assignment-engine');

class EventsController {
  async _loadExperiment(experimentKey, userId) {
    const cacheKey = `experiment:${experimentKey}`;
    let experiment = null;

    try {
      experiment = await redisCache.get(cacheKey);
      if (experiment && experiment.user_id !== userId) {
        experiment = null;
      }
    } catch (err) {
      logger.error('Redis lookup failure for event validation', { experimentKey, error: err.message });
    }

    if (!experiment) {
      experiment = await experimentsAccessor.getByKey(experimentKey, userId);
      if (experiment) {
        redisCache.set(cacheKey, {
          key: experiment.key,
          status: experiment.status,
          variants: experiment.variants,
          user_id: experiment.user_id
        }).catch(err => logger.error('Cache set error', { error: err.message }));
      }
    }

    if (!experiment) throw Errors.experiment_not_found;

    return experiment;
  }

  _validateVariant(experiment, experimentKey, variantKey) {
    const hasVariant = experiment.variants.some(v => v.key === variantKey);
    if (!hasVariant) {
      throw {
        status_code: 400,
        error_code: 'invalid_payload',
        error_message: `Variant '${variantKey}' does not exist for experiment '${experimentKey}'`
      };
    }
  }

  async recordExposure(payload, userId) {
    const { error, value } = exposureEventSchema.validate(payload);
    if (error) {
      throw error;
    }

    const { experimentKey, visitorId, variantKey, occurredAt, metadata } = value;

    const experiment = await this._loadExperiment(experimentKey, userId);
    this._validateVariant(experiment, experimentKey, variantKey);
    const assignedVariant = assignVariant(visitorId, experiment);
    if (assignedVariant !== variantKey) {
      logger.warn('Rejected exposure with assignment mismatch', { experimentKey, visitorId, submittedVariantKey: variantKey });
      throw Errors.assignment_mismatch;
    }

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

  async recordTelemetry(payload, userId) {
    const { error, value } = telemetryEventSchema.validate(payload);
    if (error) {
      throw error;
    }

    const { experimentKey, visitorId, variantKey, eventType, eventName, occurredAt, metadata } = value;

    await this._loadExperiment(experimentKey, userId);

    if (eventType === 'conversion') {
      const result = await eventsAccessor.recordConversionFromVerifiedExposure({
        experimentKey,
        visitorId,
        eventName,
        occurredAt,
        metadata
      });
      if (!result.exposure_found) {
        logger.warn('Rejected conversion without verified exposure', { experimentKey, visitorId, eventName });
        throw Errors.exposure_not_found;
      }
      return { deduped: !result.inserted };
    }

    const experiment = await this._loadExperiment(experimentKey, userId);
    this._validateVariant(experiment, experimentKey, variantKey);

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
