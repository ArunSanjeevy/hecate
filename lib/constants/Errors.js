'use strict';

module.exports = {
  authentication_failed: {
    error_code: 'authentication_failed',
    error_message: 'Unauthorized: Missing or invalid API key',
    status_code: 401
  },
  invalid_payload: {
    error_code: 'invalid_payload',
    error_message: 'Bad Request: Invalid payload structure',
    status_code: 400
  },
  experiment_not_found: {
    error_code: 'experiment_not_found',
    error_message: 'Experiment not found',
    status_code: 404
  },
  duplicate_experiment_key: {
    error_code: 'duplicate_experiment_key',
    error_message: 'Experiment key already exists',
    status_code: 409
  },
  duplicate_email: {
    error_code: 'duplicate_email',
    error_message: 'Email is already registered',
    status_code: 409
  },
  invalid_credentials: {
    error_code: 'invalid_credentials',
    error_message: 'Invalid email or password',
    status_code: 401
  },
  generic_error: {
    error_code: 'generic_error',
    error_message: 'Sorry, something went wrong. Please try again after some time',
    status_code: 500
  }
};
