'use strict';

const eventsController = require('../controllers/events-controller');

const recordExposure = async (req, res, next) => {
  try {
    const result = await eventsController.recordExposure(req.body, req.user.id);
    return res.status(200).json({
      status: 'success',
      deduped: result.deduped
    });
  } catch (err) {
    next(err);
  }
};

const recordTelemetry = async (req, res, next) => {
  try {
    const result = await eventsController.recordTelemetry(req.body, req.user.id);
    return res.status(200).json({
      status: 'success',
      deduped: result.deduped
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  recordExposure,
  recordTelemetry
};
