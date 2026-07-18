'use strict';

const Errors = require('../constants/Errors');
const logger = require('../helpers/logger');

const errorHandler = (err, req, res, next) => {
  if (err.status_code) {
    logger.warn('API warning/error', {
      path: req.path,
      status_code: err.status_code,
      error_code: err.error_code,
      message: err.error_message
    });
    return res.status(err.status_code).json({
      status: 'failed',
      error_code: err.error_code,
      message: err.error_message
    });
  }

  if (err.isJoi) {
    logger.warn('Joi validation error', {
      path: req.path,
      message: err.message,
      details: err.details
    });
    return res.status(400).json({
      status: 'failed',
      error_code: 'invalid_payload',
      message: err.message
    });
  }

  logger.error('Unexpected server error', {
    path: req.path,
    message: err.message,
    stack: err.stack
  });

  return res.status(Errors.generic_error.status_code).json({
    status: 'failed',
    error_code: Errors.generic_error.error_code,
    message: Errors.generic_error.error_message
  });
};

module.exports = errorHandler;
