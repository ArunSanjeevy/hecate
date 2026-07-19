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
        variants: experiment.variants
      }
    });
  } catch (err) {
    next(err);
  }
};

const listExperiments = async (req, res, next) => {
  try {
    const result = await experimentsController.list(req.user.id, req.query);
    const mapped = result.experiments.map(e => ({
      key: e.key,
      status: e.status,
      variants: e.variants
    }));
    return res.status(200).json({
      experiments: mapped,
      pagination: result.pagination
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
        variants: experiment.variants
      }
    });
  } catch (err) {
    next(err);
  }
};

const deleteExperiment = async (req, res, next) => {
  try {
    const experiment = await experimentsController.archive(req.params.key, req.user.id);
    return res.status(200).json({
      status: 'success',
      message: 'Experiment archived successfully',
      experiment: {
        key: experiment.key,
        status: experiment.status,
        variants: experiment.variants
      }
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
