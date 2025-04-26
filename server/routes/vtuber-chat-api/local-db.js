const express = require('express');

const router = new express.Router();
const { beforeCreateLocalDbRequest } = require('../../route-hooks/local-db');
const { handleCreateLocalDbRequest } = require('../../route-handlers/local-db');

// router.post('/', beforeCreateLocalDbRequest, handleCreateLocalDbRequest);

module.exports = router;
