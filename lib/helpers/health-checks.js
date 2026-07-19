'use strict';

const { db } = require('../data-accessors/db');
const redisCache = require('../cache/redis');

const checkPostgres = async () => {
  await db.one('SELECT 1 AS value');
  return true;
};

const checkRedis = async () => redisCache.ping();

module.exports = {
  checkPostgres,
  checkRedis
};
