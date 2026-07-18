'use strict';

const resultsAccessor = require('../data-accessors/results-accessor');
const experimentsAccessor = require('../data-accessors/experiments-accessor');
const Errors = require('../constants/Errors');

class ResultsController {
  async getResults(experimentKey, userId) {
    if (!experimentKey) {
      throw Errors.invalid_payload;
    }

    const experiment = await experimentsAccessor.getByKey(experimentKey, userId);
    if (!experiment) {
      throw Errors.experiment_not_found;
    }

    const dbResults = await resultsAccessor.getResults(experimentKey);

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
