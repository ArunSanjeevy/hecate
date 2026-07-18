'use strict';

module.exports = {
  env: 'prod',
  port: process.env.PORT || 4000,
  apiKey: process.env.API_KEY || process.env.VITE_HECATE_API_KEY,
  postgres: {
    connectionString: process.env.DATABASE_URL,
    maxConnections: 20,
    ssl: {
      enabled: process.env.DB_SSL_ENABLED !== 'false',
      rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED !== 'false',
      ca: process.env.DB_CA_CERT,
      caPath: process.env.DB_CA_CERT_PATH
    }
  },
  redis: {
    url: process.env.REDIS_URL
  },
  logDirectory: 'logs/',
  suppressLogs: false
};
