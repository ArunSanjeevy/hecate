'use strict';

const express = require('express');
const router = express.Router();
const assignmentsHandler = require('../route-handlers/assignments-handler');

router.post('/', assignmentsHandler.getAssignments);

module.exports = router;
