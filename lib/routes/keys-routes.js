'use strict';

const express = require('express');
const router = express.Router();
const keysHandler = require('../route-handlers/keys-handler');

router.get('/', keysHandler.listKeys);
router.post('/', keysHandler.createKey);
router.delete('/:id', keysHandler.revokeKey);

module.exports = router;
