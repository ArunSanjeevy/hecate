'use strict';

require('dotenv').config();
process.env.NODE_ENV = process.env.NODE_ENV || 'dev';

const { db, checkDbConnection } = require('../lib/data-accessors/db');

const check = async () => {
  try {
    await checkDbConnection();
    console.log('--- EXPERIMENTS IN DATABASE ---');
    const experiments = await db.any('SELECT * FROM experiments');
    console.log(JSON.stringify(experiments, null, 2));
    process.exit(0);
  } catch (error) {
    console.error('Failed:', error);
    process.exit(1);
  }
};

check();
