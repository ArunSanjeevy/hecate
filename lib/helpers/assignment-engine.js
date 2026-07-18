'use strict';

const crypto = require('crypto');

/**
 * Computes a stable bucket index in [0, 9999] for a given string input.
 * @param {string} input - The string to hash
 * @returns {number} The bucket index
 */
function getBucket(input) {
  const hashHex = crypto.createHash('sha256').update(input).digest('hex');
  const hashInt = parseInt(hashHex.substring(0, 8), 16);
  return hashInt % 10000;
}

function buildHashInput(experimentKey, visitorId) {
  return `${experimentKey}:${visitorId}`;
}

/**
 * Deterministically assigns a visitor to an experiment variant.
 * @param {string} visitorId
 * @param {object} experiment
 * @returns {string|null} The assigned variant key, or null if invalid
 */
function assignVariant(visitorId, experiment) {
  if (!experiment || experiment.status !== 'active') {
    return null;
  }

  const { key: experimentKey, variants } = experiment;
  if (!variants || !Array.isArray(variants) || variants.length === 0) {
    return null;
  }

  const hashInput = buildHashInput(experimentKey, visitorId);
  const bucket = getBucket(hashInput);

  let cumulativeAllocation = 0;
  for (const variant of variants) {
    const rangeEnd = cumulativeAllocation + (variant.allocation * 100);
    if (bucket >= cumulativeAllocation && bucket < rangeEnd) {
      return variant.key;
    }
    cumulativeAllocation = rangeEnd;
  }

  return null;
}

module.exports = {
  buildHashInput,
  getBucket,
  assignVariant
};
