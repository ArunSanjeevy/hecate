'use strict';

const { db } = require('../../lib/data-accessors/db');

const SAFE_TEST_DB_NAME_PATTERN = /(^test_|_test$|_test_|-test$|-test-)/i;
const UNSAFE_DATABASE_NAMES = new Set(['postgres', 'template0', 'template1']);
const ALLOWED_TRUNCATE_TABLES = new Set([
  'users',
  'experiments',
  'exposure_events',
  'telemetry_events',
  'user_api_keys'
]);

let safetyChecked = false;

const getConfiguredTestDatabaseName = () => {
  if (!process.env.TEST_DATABASE_URL) {
    throw new Error('TEST_DATABASE_URL is required before running integration tests');
  }

  let parsedUrl;
  try {
    parsedUrl = new URL(process.env.TEST_DATABASE_URL);
  } catch (error) {
    throw new Error(`TEST_DATABASE_URL must be a valid PostgreSQL URL: ${error.message}`);
  }

  const databaseName = parsedUrl.pathname.replace(/^\//, '');
  if (!databaseName) {
    throw new Error('TEST_DATABASE_URL must include a database name');
  }

  return databaseName;
};

const assertSafeDatabaseName = (databaseName) => {
  if (UNSAFE_DATABASE_NAMES.has(databaseName.toLowerCase()) || !SAFE_TEST_DB_NAME_PATTERN.test(databaseName)) {
    throw new Error(`Refusing to run destructive integration tests against non-test database '${databaseName}'`);
  }
};

const assertSafeTestDatabase = async () => {
  if (safetyChecked) {
    return;
  }

  if (process.env.NODE_ENV !== 'test') {
    throw new Error(`Integration tests require NODE_ENV=test; received '${process.env.NODE_ENV || ''}'`);
  }

  const configuredDatabaseName = getConfiguredTestDatabaseName();
  assertSafeDatabaseName(configuredDatabaseName);

  const { current_database: connectedDatabaseName } = await db.one('SELECT current_database()');
  if (connectedDatabaseName !== configuredDatabaseName) {
    throw new Error(`Connected database '${connectedDatabaseName}' does not match TEST_DATABASE_URL database '${configuredDatabaseName}'`);
  }
  assertSafeDatabaseName(connectedDatabaseName);

  safetyChecked = true;
};

const truncateTables = async (tables) => {
  await assertSafeTestDatabase();
  const unsafeTable = tables.find(table => !ALLOWED_TRUNCATE_TABLES.has(table));
  if (unsafeTable) {
    throw new Error(`Refusing to truncate unapproved test table '${unsafeTable}'`);
  }
  await db.none(`TRUNCATE TABLE ${tables.join(', ')} CASCADE`);
};

module.exports = {
  assertSafeTestDatabase,
  truncateTables
};
