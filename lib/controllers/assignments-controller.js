'use strict';

const experimentsAccessor = require('../data-accessors/experiments-accessor');
const experimentCache = require('../cache/experiment-cache');
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
      let experiment = null;
      let errorOccurred = false;

      experiment = await experimentCache.get(userId, key);

      if (!experiment) {
        try {
          experiment = await experimentsAccessor.getByKey(key, userId);
          if (experiment) {
            experimentCache.set(userId, experiment);
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
          const assignment = {
            experimentKey: key,
            variantKey
          };
          const variant = experiment.variants.find(item => item.key === variantKey);
          if (variant && variant.content) {
            assignment.content = variant.content;
          }
          assignments.push(assignment);
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
