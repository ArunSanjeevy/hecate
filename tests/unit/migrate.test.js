'use strict';

jest.mock('../../lib/data-accessors/db', () => ({
  db: {
    none: jest.fn()
  }
}));

jest.mock('../../lib/helpers/logger', () => ({
  info: jest.fn(),
  error: jest.fn()
}));

const { db } = require('../../lib/data-accessors/db');
const migrate = require('../../lib/helpers/migrate');

describe('database migration', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    db.none.mockResolvedValue();
  });

  it('applies schema without seeding users or API keys', async () => {
    await migrate();

    expect(db.none).toHaveBeenCalledWith(expect.stringContaining('CREATE TABLE'));
    expect(db.none.mock.calls[0][0]).not.toContain('INSERT INTO users');
    expect(db.none.mock.calls[0][0]).not.toContain('INSERT INTO user_api_keys');
  });

  it('defines created_at and updated_at columns for every table', async () => {
    await migrate();

    const schema = db.none.mock.calls[0][0];
    const tables = [
      'users',
      'user_api_keys',
      'experiments',
      'exposure_events',
      'telemetry_events'
    ];

    for (const table of tables) {
      const tableDefinition = schema.match(
        new RegExp(`CREATE TABLE IF NOT EXISTS ${table} \\([\\s\\S]*?\\n\\);`)
      );

      expect(tableDefinition).not.toBeNull();
      expect(tableDefinition[0]).toContain('created_at TIMESTAMPTZ');
      expect(tableDefinition[0]).toContain('updated_at TIMESTAMPTZ');
    }
  });
});
