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
  experiment_configuration_immutable: {
    error_code: 'experiment_configuration_immutable',
    error_message: 'Experiment variants and allocations are immutable once an experiment is active, paused, or archived. Create a new experiment key/version to change the configuration.',
    status_code: 409
  },
  invalid_experiment_status_transition: {
    error_code: 'invalid_experiment_status_transition',
    error_message: 'Invalid experiment status transition. Archived experiments are terminal and cannot be reactivated.',
    status_code: 409
  },
  rate_limit_exceeded: {
    error_code: 'rate_limit_exceeded',
    error_message: 'Too many requests. Please retry later.',
    status_code: 429
  },
  assignment_mismatch: {
    error_code: 'assignment_mismatch',
    error_message: 'Submitted variant does not match the server-assigned variant for this visitor and experiment.',
    status_code: 409
  },
  exposure_not_found: {
    error_code: 'exposure_not_found',
    error_message: 'A verified exposure is required before recording a conversion.',
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
