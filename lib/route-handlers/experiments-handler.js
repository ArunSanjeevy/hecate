'use strict';

const experimentsController = require('../controllers/experiments-controller');

const createExperiment = async (req, res, next) => {
  try {
    const experiment = await experimentsController.create(req.body, req.user.id);
    return res.status(201).json({
      status: 'success',
      experiment: {
        key: experiment.key,
        status: experiment.status,
        salt: experiment.salt,
        variants: experiment.variants
      }
    });
  } catch (err) {
    next(err);
  }
};

const getExperiment = async (req, res, next) => {
  try {
    const experiment = await experimentsController.getByKey(req.params.key, req.user.id);
    return res.status(200).json({
      key: experiment.key,
      status: experiment.status,
      salt: experiment.salt,
      variants: experiment.variants
    });
  } catch (err) {
    next(err);
  }
};

const updateExperiment = async (req, res, next) => {
  try {
    const experiment = await experimentsController.update(req.params.key, req.body, req.user.id);
    return res.status(200).json({
      status: 'success',
      experiment: {
        key: experiment.key,
        status: experiment.status,
        salt: experiment.salt,
        variants: experiment.variants
      }
    });
  } catch (err) {
    next(err);
  }
};

const listExperiments = async (req, res, next) => {
  try {
    const experiments = await experimentsController.list(req.user.id);
    const mapped = experiments.map(e => ({
      key: e.key,
      status: e.status,
      salt: e.salt,
      variants: e.variants
    }));
    return res.status(200).json({
      experiments: mapped
    });
  } catch (err) {
    next(err);
  }
};

const activateExperiment = async (req, res, next) => {
  try {
    const experiment = await experimentsController.activate(req.params.key, req.user.id);
    return res.status(200).json({
      status: 'success',
      experiment: {
        key: experiment.key,
        status: experiment.status,
        salt: experiment.salt,
        variants: experiment.variants
      }
    });
  } catch (err) {
    next(err);
  }
};

const deactivateExperiment = async (req, res, next) => {
  try {
    const experiment = await experimentsController.deactivate(req.params.key, req.user.id);
    return res.status(200).json({
      status: 'success',
      experiment: {
        key: experiment.key,
        status: experiment.status,
        salt: experiment.salt,
        variants: experiment.variants
      }
    });
  } catch (err) {
    next(err);
  }
};

const deleteExperiment = async (req, res, next) => {
  try {
    await experimentsController.delete(req.params.key, req.user.id);
    return res.status(200).json({
      status: 'success',
      message: 'Experiment deleted successfully'
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  createExperiment,
  getExperiment,
  updateExperiment,
  listExperiments,
  activateExperiment,
  deactivateExperiment,
  deleteExperiment
};
