const express = require('express');
const router = new express.Router();
router.use('/comme', require('./comme'));
router.use('/local-db', require('./local-db'));

module.exports = router;
