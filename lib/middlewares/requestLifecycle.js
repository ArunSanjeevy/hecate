'use strict';

const lifecycleState = require('../helpers/lifecycle-state');

const isHealthPath = path => path === '/health' || path === '/health/live' || path === '/health/ready';

const requestLifecycle = (req, res, next) => {
  if (lifecycleState.isShuttingDown() && !isHealthPath(req.path)) {
    return res.status(503).json({
      status: 'failed',
      error_code: 'shutting_down',
      message: 'Server is shutting down. Please retry shortly.'
    });
  }

  lifecycleState.incrementInFlight();
  let decremented = false;
  const decrementOnce = () => {
    if (!decremented) {
      decremented = true;
      lifecycleState.decrementInFlight();
    }
  };
  res.on('finish', decrementOnce);
  res.on('close', decrementOnce);
  return next();
};

module.exports = requestLifecycle;
