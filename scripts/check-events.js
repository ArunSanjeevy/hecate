'use strict';

require('dotenv').config();
process.env.NODE_ENV = process.env.NODE_ENV || 'dev';

const { db, checkDbConnection } = require('../lib/data-accessors/db');

const check = async () => {
  try {
    await checkDbConnection();
    
    console.log('--- EXPOSURE EVENTS ---');
    const exposures = await db.any('SELECT * FROM exposure_events');
    console.log(JSON.stringify(exposures, null, 2));
    
    console.log('--- TELEMETRY EVENTS ---');
    const telemetry = await db.any('SELECT * FROM telemetry_events');
    console.log(JSON.stringify(telemetry, null, 2));
    
    process.exit(0);
  } catch (error) {
    console.error('Failed:', error);
    process.exit(1);
  }
};

check();
