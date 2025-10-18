const express = require('express');
const router = express.Router();
const {
    handleCreateIchibanEventRequest,
    handleGetIchibanEventsRequest,
    handleGetIchibanEventRequest,
    handleUpdateIchibanEventRequest,
} = require('../../route-handlers/ichiban-event');

router.post('/', handleCreateIchibanEventRequest);
router.get('/merchantId=:merchantId', handleGetIchibanEventsRequest);
router.get('/id=:id/merchantId=:merchantId', handleGetIchibanEventRequest);
router.put('/id=:id/merchantId=:merchantId', handleUpdateIchibanEventRequest);

module.exports = router;
