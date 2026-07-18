'use strict';

const { db } = require('./db');
const Constants = require('../constants/Constants');

class UsersAccessor {
  async create(userData) {
    const { email, passwordHash } = userData;
    const query = `
      INSERT INTO ${Constants.Tables.Users} (email, password_hash)
      VALUES ($1, $2)
      RETURNING id, email, created_at
    `;
    const result = await db.one(query, [email, passwordHash]);
    return result;
  }

  async getByEmail(email) {
    const query = `
      SELECT id, email, password_hash, created_at
      FROM ${Constants.Tables.Users}
      WHERE email = $1
    `;
    const result = await db.oneOrNone(query, [email]);
    return result;
  }

  async getById(id) {
    const query = `
      SELECT id, email, created_at
      FROM ${Constants.Tables.Users}
      WHERE id = $1
    `;
    const result = await db.oneOrNone(query, [id]);
    return result;
  }
}

module.exports = new UsersAccessor();
