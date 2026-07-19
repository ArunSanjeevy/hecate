'use strict';

const getExperimentCacheKey = (userId, experimentKey) => `experiment:${userId}:${experimentKey}`;

module.exports = {
  getExperimentCacheKey
};

