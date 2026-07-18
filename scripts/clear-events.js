'use strict';

require('dotenv').config();
process.env.NODE_ENV = process.env.NODE_ENV || 'dev';

const { db, checkDbConnection } = require('../lib/data-accessors/db');

const clear = async () => {
  try {
    await checkDbConnection();
    console.log('Truncating events tables...');
    await db.none('TRUNCATE TABLE exposure_events, telemetry_events RESTART IDENTITY CASCADE');
    console.log('Tables truncated successfully.');
    process.exit(0);
  } catch (error) {
    console.error('Failed:', error);
    process.exit(1);
  }
};

clear();
