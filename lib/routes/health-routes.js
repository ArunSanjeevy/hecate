'use strict';

const express = require('express');
const router = express.Router();
const healthHandler = require('../route-handlers/health-handler');

router.get('/health', healthHandler.getHealth);
router.get('/health/live', healthHandler.getLiveness);
router.get('/health/ready', healthHandler.getReadiness);

module.exports = router;
