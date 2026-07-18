'use strict';

const { db } = require('./db');
const Constants = require('../constants/Constants');

class ExperimentsAccessor {
  async getByKey(key, userId) {
    const query = `
      SELECT id, key, status, salt, variants, user_id, created_at, updated_at
      FROM ${Constants.Tables.Experiments}
      WHERE key = $1 AND user_id = $2
    `;
    const result = await db.oneOrNone(query, [key, userId]);
    return result;
  }

  async create(experimentData) {
    const { key, status, salt, variants, userId } = experimentData;
    const query = `
      INSERT INTO ${Constants.Tables.Experiments} (key, status, salt, variants, user_id)
      VALUES ($1, $2, $3, $4:json, $5)
      RETURNING id, key, status, salt, variants, user_id, created_at, updated_at
    `;
    const result = await db.one(query, [key, status, salt || 'v1', variants, userId]);
    return result;
  }

  async update(key, updateData, userId) {
    const { status, variants } = updateData;
    const query = `
      UPDATE ${Constants.Tables.Experiments}
      SET status = $1, variants = $2:json, updated_at = CURRENT_TIMESTAMP
      WHERE key = $3 AND user_id = $4
      RETURNING id, key, status, salt, variants, user_id, created_at, updated_at
    `;
    const result = await db.oneOrNone(query, [status, variants, key, userId]);
    return result;
  }

  async list(userId) {
    const query = `
      SELECT id, key, status, salt, variants, user_id, created_at, updated_at
      FROM ${Constants.Tables.Experiments}
      WHERE user_id = $1
      ORDER BY created_at DESC
    `;
    const result = await db.any(query, [userId]);
    return result;
  }

  async updateStatus(key, status, userId) {
    const query = `
      UPDATE ${Constants.Tables.Experiments}
      SET status = $1, updated_at = CURRENT_TIMESTAMP
      WHERE key = $2 AND user_id = $3
      RETURNING id, key, status, salt, variants, user_id, created_at, updated_at
    `;
    const result = await db.oneOrNone(query, [status, key, userId]);
    return result;
  }

  async delete(key, userId) {
    const query = `
      DELETE FROM ${Constants.Tables.Experiments}
      WHERE key = $1 AND user_id = $2
      RETURNING id
    `;
    const result = await db.oneOrNone(query, [key, userId]);
    return result;
  }
}

module.exports = new ExperimentsAccessor();
