const express = require('express');
const router = new express.Router();
router.use('/comme', require('./comme'));
router.use('/health', require('./health'));
router.use('/fundraising-events', require('./fundraising-event'));
router.use('/ichiban-events', require('./ichiban-event'));

module.exports = router;
