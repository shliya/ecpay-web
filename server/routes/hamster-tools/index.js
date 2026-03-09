const express = require('express');
const logApiCallerIp = require('../../middleware/log-api-caller-ip');

const router = new express.Router();
router.use(logApiCallerIp);
router.use('/login', require('./login'));
router.use('/comme', require('./comme'));
router.use('/health', require('./health'));
router.use('/fundraising-events', require('./fundraising-event'));
router.use('/ichiban-events', require('./ichiban-event'));
router.use('/payment', require('./payment'));

module.exports = router;
