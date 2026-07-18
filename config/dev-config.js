'use strict';

module.exports = {
  env: 'dev',
  port: process.env.PORT || 4000,
  apiKey: process.env.API_KEY || 'dev-api-key',
  postgres: {
    connectionString: process.env.DATABASE_URL || 'postgres://admin:hecate@localhost:5432/hecate_development',
    maxConnections: 10
  },
  redis: {
    url: process.env.REDIS_URL || 'redis://localhost:6379'
  },
  logDirectory: 'logs/',
  suppressLogs: false
};
