'use strict';

const authController = require('../controllers/auth-controller');

const signup = async (req, res, next) => {
  try {
    const result = await authController.signup(req.body);
    return res.status(201).json({
      status: 'success',
      message: 'User registered successfully',
      user: result.user,
      apiKey: result.apiKey
    });
  } catch (err) {
    next(err);
  }
};

const login = async (req, res, next) => {
  try {
    const result = await authController.login(req.body);
    return res.status(200).json({
      status: 'success',
      token: result.token,
      user: result.user,
      apiKeys: result.apiKeys
    });
  } catch (err) {
    next(err);
  }
};

module.exports = {
  signup,
  login
};
