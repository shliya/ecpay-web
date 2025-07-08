const express = require('express');
const router = new express.Router();
const {
    handleGetFundraisingEventsRequest,
    handleCreateFundraisingEventRequest,
} = require('../../route-handlers/comme');

router.get('/id=:merchantId', handleGetFundraisingEventsRequest);
router.post('/', handleCreateFundraisingEventRequest);

module.exports = router;
