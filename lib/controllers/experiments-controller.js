'use strict';

const experimentsAccessor = require('../data-accessors/experiments-accessor');
const { createExperimentSchema, updateExperimentSchema, experimentKeyParamSchema, paginationSchema } = require('../helpers/validation');
const experimentCache = require('../cache/experiment-cache');
const Errors = require('../constants/Errors');
const Constants = require('../constants/Constants');

class ExperimentsController {
  _validateExperimentKey(key) {
    const { error, value } = experimentKeyParamSchema.validate(key);
    if (error) {
      throw error;
    }
    return value;
  }

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

      await experimentCache.set(userId, experiment);

      return experiment;
    } catch (err) {
      if (err.code === '23505') {
        throw Errors.duplicate_experiment_key;
      }
      throw err;
    }
  }

  async getByKey(key, userId) {
    key = this._validateExperimentKey(key);

    let experiment = await experimentCache.get(userId, key);

    if (!experiment) {
      experiment = await experimentsAccessor.getByKey(key, userId);
      if (experiment) {
        experimentCache.set(userId, experiment);
      }
    }

    if (!experiment) {
      throw Errors.experiment_not_found;
    }

    return experiment;
  }

  async update(key, payload, userId) {
    key = this._validateExperimentKey(key);

    const { error, value } = updateExperimentSchema.validate(payload);
    if (error) {
      throw error;
    }

    const experiment = await experimentsAccessor.update(key, value, userId);
    if (!experiment) {
      // The draft predicate is part of the UPDATE, so a status transition
      // cannot race an in-place configuration change. This read is only used
      // to distinguish a missing experiment from an immutable configuration.
      const existing = await experimentsAccessor.getByKey(key, userId);
      if (existing) {
        throw Errors.experiment_configuration_immutable;
      }
      throw Errors.experiment_not_found;
    }

    await experimentCache.del(userId, key);

    return experiment;
  }

  async list(userId, query = {}) {
    const { error, value: pagination } = paginationSchema.validate(query, { convert: true });
    if (error) {
      throw error;
    }

    const [experiments, total] = await Promise.all([
      experimentsAccessor.list(userId, pagination),
      experimentsAccessor.count(userId)
    ]);

    return {
      experiments,
      pagination: {
        limit: pagination.limit,
        offset: pagination.offset,
        total,
        hasMore: pagination.offset + experiments.length < total
      }
    };
  }

  async activate(key, userId) {
    key = this._validateExperimentKey(key);

    const experiment = await experimentsAccessor.updateStatus(key, Constants.ExperimentStatus.Active, userId);
    if (!experiment) {
      const existing = await experimentsAccessor.getByKey(key, userId);
      if (existing) {
        throw Errors.invalid_experiment_status_transition;
      }
      throw Errors.experiment_not_found;
    }

    await experimentCache.del(userId, key);

    return experiment;
  }

  async deactivate(key, userId) {
    key = this._validateExperimentKey(key);

    const experiment = await experimentsAccessor.updateStatus(key, Constants.ExperimentStatus.Paused, userId);
    if (!experiment) {
      const existing = await experimentsAccessor.getByKey(key, userId);
      if (existing) {
        throw Errors.invalid_experiment_status_transition;
      }
      throw Errors.experiment_not_found;
    }

    await experimentCache.del(userId, key);

    return experiment;
  }

  async archive(key, userId) {
    key = this._validateExperimentKey(key);

    const experiment = await experimentsAccessor.archive(key, userId);
    if (!experiment) {
      const existing = await experimentsAccessor.getByKey(key, userId);
      if (existing) {
        throw Errors.invalid_experiment_status_transition;
      }
      throw Errors.experiment_not_found;
    }

    await experimentCache.del(userId, key);

    return experiment;
  }
}

module.exports = new ExperimentsController();

