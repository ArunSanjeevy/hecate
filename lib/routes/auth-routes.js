'use strict';

const express = require('express');
const router = express.Router();
const authHandler = require('../route-handlers/auth-handler');

router.post('/signup', authHandler.signup);
router.post('/login', authHandler.login);

module.exports = router;
