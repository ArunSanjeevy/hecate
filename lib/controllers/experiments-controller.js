'use strict';

const experimentsAccessor = require('../data-accessors/experiments-accessor');
const { createExperimentSchema, updateExperimentSchema } = require('../helpers/validation');
const redisCache = require('../cache/redis');
const Errors = require('../constants/Errors');
const logger = require('../helpers/logger');

class ExperimentsController {
  async create(payload) {
    const { error, value } = createExperimentSchema.validate(payload);
    if (error) {
      throw error;
    }

    const { key, status, variants } = value;
    const salt = 'v1';

    try {
      const experiment = await experimentsAccessor.create({
        key,
        status,
        salt,
        variants
      });

      const cacheKey = `experiment:${key}`;
      await redisCache.set(cacheKey, {
        key: experiment.key,
        status: experiment.status,
        salt: experiment.salt,
        variants: experiment.variants
      });

      return experiment;
    } catch (err) {
      if (err.code === '23505') {
        throw Errors.duplicate_experiment_key;
      }
      throw err;
    }
  }

  async getByKey(key) {
    if (!key) {
      throw Errors.invalid_payload;
    }

    const experiment = await experimentsAccessor.getByKey(key);
    if (!experiment) {
      throw Errors.experiment_not_found;
    }

    return experiment;
  }

  async update(key, payload) {
    if (!key) {
      throw Errors.invalid_payload;
    }

    const { error, value } = updateExperimentSchema.validate(payload);
    if (error) {
      throw error;
    }

    const experiment = await experimentsAccessor.update(key, value);
    if (!experiment) {
      throw Errors.experiment_not_found;
    }

    const cacheKey = `experiment:${key}`;
    await redisCache.del(cacheKey);

    return experiment;
  }

  async list() {
    return await experimentsAccessor.list();
  }

  async activate(key) {
    if (!key) {
      throw Errors.invalid_payload;
    }

    const experiment = await experimentsAccessor.updateStatus(key, 'active');
    if (!experiment) {
      throw Errors.experiment_not_found;
    }

    const cacheKey = `experiment:${key}`;
    await redisCache.del(cacheKey);

    return experiment;
  }

  async deactivate(key) {
    if (!key) {
      throw Errors.invalid_payload;
    }

    const experiment = await experimentsAccessor.updateStatus(key, 'paused');
    if (!experiment) {
      throw Errors.experiment_not_found;
    }

    const cacheKey = `experiment:${key}`;
    await redisCache.del(cacheKey);

    return experiment;
  }

  async delete(key) {
    if (!key) {
      throw Errors.invalid_payload;
    }

    const result = await experimentsAccessor.delete(key);
    if (!result) {
      throw Errors.experiment_not_found;
    }

    const cacheKey = `experiment:${key}`;
    await redisCache.del(cacheKey);

    return true;
  }
}

module.exports = new ExperimentsController();
