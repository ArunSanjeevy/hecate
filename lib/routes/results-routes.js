'use strict';

const express = require('express');
const router = express.Router();
const resultsHandler = require('../route-handlers/results-handler');

router.get('/:experimentKey', resultsHandler.getResults);

module.exports = router;
