const express = require('express');
const router = new express.Router();
router.use('/comme', require('./comme'));
router.use('/local-db', require('./local-db'));
router.use('/health', require('./health'));

module.exports = router;
