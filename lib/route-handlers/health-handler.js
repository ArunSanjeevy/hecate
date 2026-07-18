'use strict';

const getHealth = (req, res, next) => {
  res.status(200).json({ status: 'ok' });
};

module.exports = {
  getHealth
};
