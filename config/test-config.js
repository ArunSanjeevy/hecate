'use strict';

module.exports = {
  env: 'test',
  port: process.env.PORT || 4001,
  apiKey: process.env.API_KEY || 'dev-api-key',
  postgres: {
    connectionString: process.env.DATABASE_URL || 'postgres://admin:hecate@localhost:5432/hecate_test',
    maxConnections: 5
  },
  redis: {
    url: process.env.REDIS_URL || 'redis://localhost:6379'
  },
  logDirectory: 'logs/',
  suppressLogs: true
};
