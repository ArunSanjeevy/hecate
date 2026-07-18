'use strict';

const express = require('express');
const router = express.Router();
const healthHandler = require('../route-handlers/health-handler');

router.get('/health', healthHandler.getHealth);

module.exports = router;
