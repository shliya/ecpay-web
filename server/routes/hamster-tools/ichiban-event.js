const express = require('express');
const router = new express.Router();
const requireMerchantAuth = require('../../middleware/require-merchant-auth');
const {
    handleCreateIchibanEventRequest,
    handleGetIchibanEventsRequest,
    handleGetIchibanEventRequest,
    handleUpdateIchibanEventRequest,
} = require('../../route-handlers/ichiban-event');

router.get('/merchantId=:merchantId', handleGetIchibanEventsRequest);
router.get('/id=:id/merchantId=:merchantId', handleGetIchibanEventRequest);

router.post('/', requireMerchantAuth, handleCreateIchibanEventRequest);
router.put(
    '/id=:id/merchantId=:merchantId',
    requireMerchantAuth,
    handleUpdateIchibanEventRequest
);

module.exports = router;
