'use strict';

const keysController = require('../controllers/keys-controller');

const listKeys = async (req, res, next) => {
  try {
    const result = await keysController.listKeys(req.user.id, req.query);
    return res.status(200).json({
      status: 'success',
      keys: result.keys,
      pagination: result.pagination
    });
  } catch (err) {
    next(err);
  }
};

const createKey = async (req, res, next) => {
  try {
    const key = await keysController.createKey(req.body, req.user.id);
    return res.status(201).json({
      status: 'success',
      key
    });
  } catch (err) {
    next(err);
  }
};

const revokeKey = async (req, res, next) => {
  try {
    await keysController.revokeKey(req.params.id, req.user.id);
    return res.status(200).json({
      status: 'success',
      message: 'API key revoked successfully'
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  listKeys,
  createKey,
  revokeKey
};
