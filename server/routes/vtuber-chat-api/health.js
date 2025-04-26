const express = require('express');

const router = new express.Router();
const { handleGetHealthRequest } = require('../../route-handlers/health');

router.get('/', handleGetHealthRequest);

module.exports = router;
