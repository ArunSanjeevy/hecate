'use strict';

const express = require('express');
const router = express.Router();
const experimentsHandler = require('../route-handlers/experiments-handler');

router.post('/', experimentsHandler.createExperiment);
router.get('/', experimentsHandler.listExperiments);
router.get('/:key', experimentsHandler.getExperiment);
router.put('/:key', experimentsHandler.updateExperiment);
router.post('/:key/activate', experimentsHandler.activateExperiment);
router.post('/:key/deactivate', experimentsHandler.deactivateExperiment);
router.delete('/:key', experimentsHandler.deleteExperiment);

module.exports = router;
