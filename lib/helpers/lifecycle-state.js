'use strict';

let shuttingDown = false;
let inFlightRequests = 0;
const drainWaiters = new Set();

const isShuttingDown = () => shuttingDown;

const markShuttingDown = () => {
  shuttingDown = true;
};

const incrementInFlight = () => {
  inFlightRequests += 1;
};

const decrementInFlight = () => {
  inFlightRequests = Math.max(0, inFlightRequests - 1);
  if (inFlightRequests === 0) {
    drainWaiters.forEach(resolve => resolve());
    drainWaiters.clear();
  }
};

const getInFlightRequests = () => inFlightRequests;

const waitForDrain = () => {
  if (inFlightRequests === 0) {
    return Promise.resolve();
  }
  return new Promise(resolve => {
    drainWaiters.add(resolve);
  });
};

const resetForTests = () => {
  shuttingDown = false;
  inFlightRequests = 0;
  drainWaiters.clear();
};

module.exports = {
  isShuttingDown,
  markShuttingDown,
  incrementInFlight,
  decrementInFlight,
  getInFlightRequests,
  waitForDrain,
  resetForTests
};
