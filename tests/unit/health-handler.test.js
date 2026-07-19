'use strict';

jest.mock('../../lib/helpers/health-checks', () => ({
  checkPostgres: jest.fn(),
  checkRedis: jest.fn()
}));

const lifecycleState = require('../../lib/helpers/lifecycle-state');
const healthChecks = require('../../lib/helpers/health-checks');
const healthHandler = require('../../lib/route-handlers/health-handler');

const createResponse = () => {
  const res = {
    statusCode: null,
    body: null,
    status: jest.fn((code) => {
      res.statusCode = code;
      return res;
    }),
    json: jest.fn((body) => {
      res.body = body;
      return res;
    })
  };
  return res;
};

describe('health handler', () => {
  beforeEach(() => {
    lifecycleState.resetForTests();
    jest.clearAllMocks();
  });

  it('returns liveness status for the process', () => {
    const res = createResponse();

    healthHandler.getLiveness({}, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.body).toEqual({ status: 'ok' });
  });

  it('returns ready when Postgres is healthy and Redis is available', async () => {
    healthChecks.checkPostgres.mockResolvedValue(true);
    healthChecks.checkRedis.mockResolvedValue(true);
    const res = createResponse();

    await healthHandler.getReadiness({}, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.body).toEqual({
      status: 'ready',
      dependencies: {
        postgres: 'ok',
        redis: 'ok'
      }
    });
  });

  it('fails readiness when Postgres is unavailable', async () => {
    healthChecks.checkPostgres.mockRejectedValue(new Error('db down'));
    healthChecks.checkRedis.mockResolvedValue(true);
    const res = createResponse();

    await healthHandler.getReadiness({}, res);

    expect(res.status).toHaveBeenCalledWith(503);
    expect(res.body).toEqual({
      status: 'not_ready',
      dependencies: {
        postgres: 'failed',
        redis: 'ok'
      }
    });
  });

  it('reports Redis as degraded without failing readiness', async () => {
    healthChecks.checkPostgres.mockResolvedValue(true);
    healthChecks.checkRedis.mockResolvedValue(false);
    const res = createResponse();

    await healthHandler.getReadiness({}, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.body).toEqual({
      status: 'ready',
      dependencies: {
        postgres: 'ok',
        redis: 'degraded'
      }
    });
  });

  it('fails readiness during shutdown', async () => {
    lifecycleState.markShuttingDown();
    healthChecks.checkPostgres.mockResolvedValue(true);
    healthChecks.checkRedis.mockResolvedValue(true);
    const res = createResponse();

    await healthHandler.getReadiness({}, res);

    expect(res.status).toHaveBeenCalledWith(503);
    expect(res.body.status).toBe('not_ready');
  });
});
