'use strict';

const EventEmitter = require('events');
const lifecycleState = require('../../lib/helpers/lifecycle-state');
const requestLifecycle = require('../../lib/middlewares/requestLifecycle');

const createResponse = () => {
  const res = new EventEmitter();
  res.status = jest.fn(() => res);
  res.json = jest.fn(() => res);
  return res;
};

describe('request lifecycle middleware', () => {
  beforeEach(() => {
    lifecycleState.resetForTests();
    jest.clearAllMocks();
  });

  it('tracks in-flight requests and decrements once on response completion', () => {
    const res = createResponse();
    const next = jest.fn();

    requestLifecycle({ path: '/api/v1/experiments' }, res, next);

    expect(next).toHaveBeenCalled();
    expect(lifecycleState.getInFlightRequests()).toBe(1);

    res.emit('finish');
    res.emit('close');

    expect(lifecycleState.getInFlightRequests()).toBe(0);
  });

  it('rejects non-health requests while shutting down', () => {
    lifecycleState.markShuttingDown();
    const res = createResponse();
    const next = jest.fn();

    requestLifecycle({ path: '/api/v1/experiments' }, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(503);
    expect(res.json).toHaveBeenCalledWith({
      status: 'failed',
      error_code: 'shutting_down',
      message: 'Server is shutting down. Please retry shortly.'
    });
  });
});
