'use strict';

const lifecycleState = require('../helpers/lifecycle-state');
const healthChecks = require('../helpers/health-checks');

const getLiveness = (req, res) => {
  res.status(200).json({
    status: lifecycleState.isShuttingDown() ? 'shutting_down' : 'ok'
  });
};

const getReadiness = async (req, res) => {
  const dependencies = {
    postgres: 'unknown',
    redis: 'unknown'
  };

  let ready = !lifecycleState.isShuttingDown();

  try {
    await healthChecks.checkPostgres();
    dependencies.postgres = 'ok';
  } catch (error) {
    dependencies.postgres = 'failed';
    ready = false;
  }

  try {
    const redisOk = await healthChecks.checkRedis();
    dependencies.redis = redisOk ? 'ok' : 'degraded';
  } catch (error) {
    dependencies.redis = 'degraded';
  }

  return res.status(ready ? 200 : 503).json({
    status: ready ? 'ready' : 'not_ready',
    dependencies
  });
};

module.exports = {
  getHealth: getLiveness,
  getLiveness,
  getReadiness
};
