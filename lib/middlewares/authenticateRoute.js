'use strict';

const Errors = require('../constants/Errors');
const path = require('path');

const env = process.env.NODE_ENV || 'dev';
const config = require(path.join(__dirname, `../../config/${env}-config.js`));

const authenticateRoute = (req, res, next) => {
  const apiKey = req.headers['x-api-key'];
  if (!apiKey || apiKey !== config.apiKey) {
    return next(Errors.authentication_failed);
  }
  next();
};

module.exports = { auth: authenticateRoute };
