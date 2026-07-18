'use strict';

const winston = require('winston');
const rTracer = require('cls-rtracer');
const path = require('path');

const env = process.env.NODE_ENV || 'dev';
const config = require(path.join(__dirname, `../../config/${env}-config.js`));

const customFormat = winston.format.printf(({ level, message, timestamp, ...meta }) => {
  const reqId = rTracer.id();
  const reqIdStr = reqId ? ` [${reqId}]` : '';
  const metaStr = Object.keys(meta).length ? ` ${JSON.stringify(meta)}` : '';
  return `${timestamp}${reqIdStr} [${level.toUpperCase()}]: ${message}${metaStr}`;
});

const logger = winston.createLogger({
  level: config.suppressLogs ? 'error' : 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console({
      silent: config.suppressLogs,
      format: winston.format.combine(
        winston.format.timestamp(),
        customFormat
      )
    })
  ]
});

module.exports = logger;
