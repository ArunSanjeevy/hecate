'use strict';

const experimentsAccessor = require('../data-accessors/experiments-accessor');
const { createExperimentSchema, updateExperimentSchema } = require('../helpers/validation');
const redisCache = require('../cache/redis');
const Errors = require('../constants/Errors');
const logger = require('../helpers/logger');

class ExperimentsController {
  async create(payload, userId) {
    const { error, value } = createExperimentSchema.validate(payload);
    if (error) {
      throw error;
    }

    const { key, status, variants } = value;

    try {
      const experiment = await experimentsAccessor.create({
        key,
        status,
        variants,
        userId
      });

      const cacheKey = `experiment:${key}`;
      await redisCache.set(cacheKey, {
        key: experiment.key,
        status: experiment.status,
        variants: experiment.variants,
        user_id: experiment.user_id
      });

      return experiment;
    } catch (err) {
      if (err.code === '23505') {
        throw Errors.duplicate_experiment_key;
      }
      throw err;
    }
  }

  async getByKey(key, userId) {
    if (!key) {
      throw Errors.invalid_payload;
    }

    let experiment = null;
    const cacheKey = `experiment:${key}`;

    try {
      experiment = await redisCache.get(cacheKey);
      if (experiment && experiment.user_id !== userId) {
        experiment = null;
      }
    } catch (err) {
      logger.error('Redis cache lookup error in getByKey, falling back to database', { key, error: err.message });
    }

    if (!experiment) {
      experiment = await experimentsAccessor.getByKey(key, userId);
      if (experiment) {
        // Cache it asynchronously
        redisCache.set(cacheKey, {
          key: experiment.key,
          status: experiment.status,
          variants: experiment.variants,
          user_id: experiment.user_id
        }).catch(cacheErr => {
          logger.error('Failed to populate Redis cache in getByKey', { key, error: cacheErr.message });
        });
      }
    }

    if (!experiment) {
      throw Errors.experiment_not_found;
    }

    return experiment;
  }

  async update(key, payload, userId) {
    if (!key) {
      throw Errors.invalid_payload;
    }

    const { error, value } = updateExperimentSchema.validate(payload);
    if (error) {
      throw error;
    }

    // Verify first that it belongs to user
    const existing = await experimentsAccessor.getByKey(key, userId);
    if (!existing) {
      throw Errors.experiment_not_found;
    }

    const experiment = await experimentsAccessor.update(key, value, userId);
    if (!experiment) {
      throw Errors.experiment_not_found;
    }

    const cacheKey = `experiment:${key}`;
    await redisCache.del(cacheKey);

    return experiment;
  }

  async list(userId) {
    return await experimentsAccessor.list(userId);
  }

  async activate(key, userId) {
    if (!key) {
      throw Errors.invalid_payload;
    }

    const experiment = await experimentsAccessor.updateStatus(key, 'active', userId);
    if (!experiment) {
      throw Errors.experiment_not_found;
    }

    const cacheKey = `experiment:${key}`;
    await redisCache.del(cacheKey);

    return experiment;
  }

  async deactivate(key, userId) {
    if (!key) {
      throw Errors.invalid_payload;
    }

    const experiment = await experimentsAccessor.updateStatus(key, 'paused', userId);
    if (!experiment) {
      throw Errors.experiment_not_found;
    }

    const cacheKey = `experiment:${key}`;
    await redisCache.del(cacheKey);

    return experiment;
  }

  async delete(key, userId) {
    if (!key) {
      throw Errors.invalid_payload;
    }

    const result = await experimentsAccessor.delete(key, userId);
    if (!result) {
      throw Errors.experiment_not_found;
    }

    const cacheKey = `experiment:${key}`;
    await redisCache.del(cacheKey);

    return true;
  }
}

module.exports = new ExperimentsController();
