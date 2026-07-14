const express = require('express');
const router = new express.Router();
const requireTotp = require('../../middleware/require-totp');
const {
    handleCreateIchibanEventRequest,
    handleGetIchibanEventsRequest,
    handleGetIchibanEventRequest,
    handleUpdateIchibanEventRequest,
} = require('../../route-handlers/ichiban-event');

router.get('/merchantId=:merchantId', handleGetIchibanEventsRequest);
router.get('/id=:id/merchantId=:merchantId', handleGetIchibanEventRequest);

router.post('/', requireTotp, handleCreateIchibanEventRequest);
router.put(
    '/id=:id/merchantId=:merchantId',
    requireTotp,
    handleUpdateIchibanEventRequest
);

module.exports = router;
