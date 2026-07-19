'use strict';

const { db } = require('./db');
const Constants = require('../constants/Constants');

class ExperimentsAccessor {
  async getByKey(key, userId) {
    const query = `
      SELECT id, key, status, variants, user_id, created_at, updated_at
      FROM ${Constants.Tables.Experiments}
      WHERE key = $1 AND user_id = $2
    `;
    const result = await db.oneOrNone(query, [key, userId]);
    return result;
  }

  async create(experimentData) {
    const { key, status, variants, userId } = experimentData;
    const query = `
      INSERT INTO ${Constants.Tables.Experiments} (key, status, variants, user_id)
      VALUES ($1, $2, $3:json, $4)
      RETURNING id, key, status, variants, user_id, created_at, updated_at
    `;
    const result = await db.one(query, [key, status, variants, userId]);
    return result;
  }

  async update(key, updateData, userId) {
    const { status, variants } = updateData;
    const query = `
      UPDATE ${Constants.Tables.Experiments}
      SET status = $1, variants = $2:json, updated_at = CURRENT_TIMESTAMP
      WHERE key = $3 AND user_id = $4 AND status = 'draft'
      RETURNING id, key, status, variants, user_id, created_at, updated_at
    `;
    const result = await db.oneOrNone(query, [status, variants, key, userId]);
    return result;
  }

  async list(userId, pagination = { limit: 20, offset: 0 }) {
    const { limit, offset } = pagination;
    const query = `
      SELECT id, key, status, variants, user_id, created_at, updated_at
      FROM ${Constants.Tables.Experiments}
      WHERE user_id = $1
      ORDER BY created_at DESC, key ASC
      LIMIT $2 OFFSET $3
    `;
    const result = await db.any(query, [userId, limit, offset]);
    return result;
  }

  async count(userId) {
    const query = `
      SELECT COUNT(*)::int AS total
      FROM ${Constants.Tables.Experiments}
      WHERE user_id = $1
    `;
    const result = await db.one(query, [userId]);
    return result.total;
  }

  async updateStatus(key, status, userId) {
    const allowedSourceStatuses = {
      [Constants.ExperimentStatus.Active]: [
        Constants.ExperimentStatus.Draft,
        Constants.ExperimentStatus.Paused
      ],
      [Constants.ExperimentStatus.Paused]: [
        Constants.ExperimentStatus.Active
      ],
      [Constants.ExperimentStatus.Archived]: [
        Constants.ExperimentStatus.Draft,
        Constants.ExperimentStatus.Active,
        Constants.ExperimentStatus.Paused
      ]
    };
    const sourceStatuses = allowedSourceStatuses[status] || [];
    const query = `
      UPDATE ${Constants.Tables.Experiments}
      SET status = $1, updated_at = CURRENT_TIMESTAMP
      WHERE key = $2 AND user_id = $3 AND status IN ($4:csv)
      RETURNING id, key, status, variants, user_id, created_at, updated_at
    `;
    const result = await db.oneOrNone(query, [status, key, userId, sourceStatuses]);
    return result;
  }

  async archive(key, userId) {
    return this.updateStatus(key, Constants.ExperimentStatus.Archived, userId);
  }
}

module.exports = new ExperimentsAccessor();
