'use strict';

module.exports = {
  Tables: {
    Users: 'users',
    UserApiKeys: 'user_api_keys',
    Experiments: 'experiments',
    ExposureEvents: 'exposure_events',
    TelemetryEvents: 'telemetry_events'
  },
  ExperimentStatus: {
    Draft: 'draft',
    Active: 'active',
    Paused: 'paused',
    Archived: 'archived'
  },
  EventTypes: {
    Conversion: 'conversion'
  }
};
