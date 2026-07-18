'use strict';

require('dotenv').config();
const pgp = require('pg-promise')();

const initTestDb = async () => {
  // Connect to the admin database first to check/create the test db.
  const defaultCn = process.env.POSTGRES_ADMIN_URL || 'postgres://postgres:postgres@localhost:5432/postgres';
  const db = pgp(defaultCn);
  
  const testDbName = 'hecate_test';
  const appRoleName = process.env.DB_APP_USER || 'admin';
  const appRolePassword = process.env.DB_APP_PASSWORD || 'hecate';
  
  try {
    console.log(`Checking if role '${appRoleName}' exists...`);
    const role = await db.oneOrNone('SELECT 1 FROM pg_roles WHERE rolname = $1', [appRoleName]);

    if (!role) {
      console.log(`Role '${appRoleName}' does not exist. Creating it...`);
      await db.none(`CREATE ROLE ${pgp.as.name(appRoleName)} WITH LOGIN PASSWORD $1`, [appRolePassword]);
      console.log(`Role '${appRoleName}' created successfully.`);
    } else {
      console.log(`Role '${appRoleName}' already exists. Updating password...`);
      await db.none(`ALTER ROLE ${pgp.as.name(appRoleName)} WITH LOGIN PASSWORD $1`, [appRolePassword]);
    }

    console.log(`Checking if database '${testDbName}' exists...`);
    const result = await db.oneOrNone("SELECT 1 FROM pg_database WHERE datname = $1", [testDbName]);
    
    if (!result) {
      console.log(`Database '${testDbName}' does not exist. Creating it...`);
      // CREATE DATABASE cannot run inside a transaction block, so we use db.none
      await db.none(`CREATE DATABASE ${pgp.as.name(testDbName)} OWNER ${pgp.as.name(appRoleName)}`);
      console.log(`Database '${testDbName}' created successfully.`);
    } else {
      console.log(`Database '${testDbName}' already exists.`);
      await db.none(`ALTER DATABASE ${pgp.as.name(testDbName)} OWNER TO ${pgp.as.name(appRoleName)}`);
      console.log(`Database '${testDbName}' owner set to '${appRoleName}'.`);
    }
    
    pgp.end();
    process.exit(0);
  } catch (error) {
    console.error('Failed to initialize test database:', error.message);
    pgp.end();
    process.exit(1);
  }
};

initTestDb();
