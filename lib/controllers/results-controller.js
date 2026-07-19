'use strict';

const resultsAccessor = require('../data-accessors/results-accessor');
const experimentsAccessor = require('../data-accessors/experiments-accessor');
const Errors = require('../constants/Errors');
const { experimentKeyParamSchema } = require('../helpers/validation');

class ResultsController {
  async getResults(experimentKey, userId) {
    const { error, value } = experimentKeyParamSchema.validate(experimentKey);
    if (error) {
      throw error;
    }
    experimentKey = value;

    const experiment = await experimentsAccessor.getByKey(experimentKey, userId);
    if (!experiment) {
      throw Errors.experiment_not_found;
    }

    const dbResults = await resultsAccessor.getResults(experimentKey, userId);

    const variants = dbResults.map(row => {
      const exposures = row.exposures;
      const conversions = row.conversions;
      const conversionRate = exposures > 0 ? conversions / exposures : 0;
      return {
        variantKey: row.variant_key,
        exposures,
        conversions,
        conversionRate
      };
    });

    return {
      experimentKey,
      variants
    };
  }
}

module.exports = new ResultsController();
