'use strict';

const experimentsAccessor = require('../data-accessors/experiments-accessor');
const redisCache = require('../cache/redis');
const { assignVariant } = require('../helpers/assignment-engine');
const { assignmentRequestSchema } = require('../helpers/validation');
const Errors = require('../constants/Errors');
const logger = require('../helpers/logger');

class AssignmentsController {
  async getAssignments(payload, userId) {
    const { error, value } = assignmentRequestSchema.validate(payload);
    if (error) {
      throw error;
    }

    const { visitorId, experimentKeys } = value;
    const assignments = [];
    const errors = [];

    for (const key of experimentKeys) {
      const cacheKey = `experiment:${key}`;
      let experiment = null;
      let errorOccurred = false;

      // Try Redis first
      try {
        experiment = await redisCache.get(cacheKey);
        if (experiment && experiment.user_id !== userId) {
          experiment = null;
        }
      } catch (err) {
        logger.error('Redis lookup failure for assignments, will fallback to PostgreSQL', { key, error: err.message });
      }

      // Try PostgreSQL on cache miss or Redis failure
      if (!experiment) {
        try {
          experiment = await experimentsAccessor.getByKey(key, userId);
          if (experiment) {
            // Populate Redis cache async
            redisCache.set(cacheKey, {
              key: experiment.key,
              status: experiment.status,
              salt: experiment.salt,
              variants: experiment.variants,
              user_id: experiment.user_id
            }).catch(cacheErr => {
              logger.error('Failed to update Redis cache after database load', { key, error: cacheErr.message });
            });
          }
        } catch (dbErr) {
          logger.error('PostgreSQL lookup failure for assignments', { key, error: dbErr.message });
          errorOccurred = true;
        }
      }

      // Handle the assignment logic
      if (errorOccurred) {
        errors.push({
          experimentKey: key,
          reason: 'experiment_unavailable'
        });
      } else if (!experiment) {
        errors.push({
          experimentKey: key,
          reason: 'experiment_not_found'
        });
      } else if (experiment.status !== 'active') {
        errors.push({
          experimentKey: key,
          reason: 'experiment_not_active'
        });
      } else {
        const variantKey = assignVariant(visitorId, experiment);
        if (variantKey) {
          assignments.push({
            experimentKey: key,
            variantKey
          });
        } else {
          errors.push({
            experimentKey: key,
            reason: 'assignment_failed'
          });
        }
      }
    }

    return {
      assignments,
      errors
    };
  }
}

module.exports = new AssignmentsController();
