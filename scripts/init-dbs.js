'use strict';

require('dotenv').config();
const pgp = require('pg-promise')();

const databaseNames = ['hecate_development', 'hecate_test', 'hecate'];
const appRoleName = process.env.DB_APP_USER || 'admin';
const appRolePassword = process.env.DB_APP_PASSWORD || 'hecate';

const initDatabases = async () => {
  const defaultCn = process.env.POSTGRES_ADMIN_URL || 'postgres://postgres:postgres@localhost:5432/postgres';
  const db = pgp(defaultCn);

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

    for (const databaseName of databaseNames) {
      console.log(`Checking if database '${databaseName}' exists...`);
      const result = await db.oneOrNone('SELECT 1 FROM pg_database WHERE datname = $1', [databaseName]);

      if (!result) {
        console.log(`Database '${databaseName}' does not exist. Creating it...`);
        await db.none(`CREATE DATABASE ${pgp.as.name(databaseName)} OWNER ${pgp.as.name(appRoleName)}`);
        console.log(`Database '${databaseName}' created successfully.`);
      } else {
        console.log(`Database '${databaseName}' already exists.`);
        await db.none(`ALTER DATABASE ${pgp.as.name(databaseName)} OWNER TO ${pgp.as.name(appRoleName)}`);
        console.log(`Database '${databaseName}' owner set to '${appRoleName}'.`);
      }
    }

    pgp.end();
    process.exit(0);
  } catch (error) {
    console.error('Failed to initialize databases:', error.message);
    pgp.end();
    process.exit(1);
  }
};

initDatabases();
