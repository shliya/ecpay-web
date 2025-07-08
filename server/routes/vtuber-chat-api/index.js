const express = require('express');
const router = new express.Router();
router.use('/comme', require('./comme'));
router.use('/local-db', require('./local-db'));
router.use('/health', require('./health'));
router.use('/fundraising-events', require('./fundraising-event'));

module.exports = router;
