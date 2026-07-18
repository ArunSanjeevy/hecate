'use strict';

const { db } = require('./db');
const Constants = require('../constants/Constants');

class ExperimentsAccessor {
  async getByKey(key) {
    const query = `
      SELECT id, key, status, salt, variants, created_at, updated_at
      FROM ${Constants.Tables.Experiments}
      WHERE key = $1
    `;
    const result = await db.oneOrNone(query, [key]);
    return result;
  }

  async create(experimentData) {
    const { key, status, salt, variants } = experimentData;
    const query = `
      INSERT INTO ${Constants.Tables.Experiments} (key, status, salt, variants)
      VALUES ($1, $2, $3, $4:json)
      RETURNING id, key, status, salt, variants, created_at, updated_at
    `;
    const result = await db.one(query, [key, status, salt || 'v1', variants]);
    return result;
  }

  async update(key, updateData) {
    const { status, variants } = updateData;
    const query = `
      UPDATE ${Constants.Tables.Experiments}
      SET status = $1, variants = $2:json, updated_at = CURRENT_TIMESTAMP
      WHERE key = $3
      RETURNING id, key, status, salt, variants, created_at, updated_at
    `;
    const result = await db.oneOrNone(query, [status, variants, key]);
    return result;
  }

  async list() {
    const query = `
      SELECT id, key, status, salt, variants, created_at, updated_at
      FROM ${Constants.Tables.Experiments}
      ORDER BY created_at DESC
    `;
    const result = await db.any(query);
    return result;
  }

  async updateStatus(key, status) {
    const query = `
      UPDATE ${Constants.Tables.Experiments}
      SET status = $1, updated_at = CURRENT_TIMESTAMP
      WHERE key = $2
      RETURNING id, key, status, salt, variants, created_at, updated_at
    `;
    const result = await db.oneOrNone(query, [status, key]);
    return result;
  }

  async delete(key) {
    const query = `
      DELETE FROM ${Constants.Tables.Experiments}
      WHERE key = $1
      RETURNING id
    `;
    const result = await db.oneOrNone(query, [key]);
    return result;
  }
}

module.exports = new ExperimentsAccessor();
