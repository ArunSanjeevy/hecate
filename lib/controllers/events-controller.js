'use strict';

const eventsAccessor = require('../data-accessors/events-accessor');
const experimentsAccessor = require('../data-accessors/experiments-accessor');
const experimentCache = require('../cache/experiment-cache');
const { exposureEventSchema, telemetryEventSchema } = require('../helpers/validation');
const Errors = require('../constants/Errors');
const logger = require('../helpers/logger');
const { assignVariant } = require('../helpers/assignment-engine');

class EventsController {
  async _loadExperiment(experimentKey, userId) {
    let experiment = await experimentCache.get(userId, experimentKey);

    if (!experiment) {
      experiment = await experimentsAccessor.getByKey(experimentKey, userId);
      if (experiment) {
        experimentCache.set(userId, experiment);
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
      userId,
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
        userId,
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
      userId,
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
