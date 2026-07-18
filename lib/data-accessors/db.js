'use strict';

const fs = require('fs');
const path = require('path');
const pgp = require('pg-promise')({
  error(err, e) {
    const logger = require('../helpers/logger');
    logger.error('Postgres database error', { err: err.message, query: e && e.query });
  }
});

const env = process.env.NODE_ENV || 'dev';
const config = require(path.join(__dirname, `../../config/${env}-config.js`));
const logger = require('../helpers/logger');

const normalizeCertificate = (certificate) => {
  if (!certificate) return certificate;
  return certificate.replace(/\\n/g, '\n');
};

const getSslConfig = () => {
  const envSslEnabled = process.env.DB_SSL_ENABLED;
  const configSsl = config.postgres.ssl || {};
  const sslEnabled = envSslEnabled ? envSslEnabled !== 'false' : configSsl.enabled;

  if (!sslEnabled) {
    return undefined;
  }

  let ca = normalizeCertificate(process.env.DB_CA_CERT || configSsl.ca);
  const caPath = process.env.DB_CA_CERT_PATH || configSsl.caPath;
  if (!ca && caPath) {
    ca = fs.readFileSync(caPath, 'utf8');
  }

  return {
    rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED !== 'false' && configSsl.rejectUnauthorized !== false,
    ...(ca ? { ca } : {})
  };
};

const removeSslModeFromConnectionString = (connectionString) => {
  if (!connectionString) return connectionString;

  try {
    const parsedUrl = new URL(connectionString);
    parsedUrl.searchParams.delete('sslmode');
    return parsedUrl.toString();
  } catch (error) {
    logger.warn('Could not parse database connection string while removing sslmode', { error: error.message });
    return connectionString;
  }
};

const ssl = getSslConfig();

const cn = {
  connectionString: ssl ? removeSslModeFromConnectionString(config.postgres.connectionString) : config.postgres.connectionString,
  max: config.postgres.maxConnections,
  query_timeout: 5000,
  ssl
};

if (!cn.connectionString && env !== 'prod') {
  // Safe default for dev/test in case environment variable is not defined
  cn.connectionString = 'postgres://postgres:postgres@localhost:5432/postgres';
}

const db = pgp(cn);

const checkDbConnection = async () => {
  try {
    await db.one('SELECT 1 AS value');
    logger.info('Database connection established successfully');
    return true;
  } catch (error) {
    logger.error('Database connection verification failed', { error: error.message });
    throw error;
  }
};

module.exports = {
  db,
  pgp,
  checkDbConnection
};
