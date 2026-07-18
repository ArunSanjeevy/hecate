'use strict';

const express = require('express');
const router = express.Router();
const eventsHandler = require('../route-handlers/events-handler');

router.post('/exposure', eventsHandler.recordExposure);
router.post('/telemetry', eventsHandler.recordTelemetry);

module.exports = router;
