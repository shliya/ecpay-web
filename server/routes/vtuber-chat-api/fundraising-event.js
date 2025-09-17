const express = require('express');
const router = new express.Router();
const {
    handleGetFundraisingEventsRequest,
    handleCreateFundraisingEventRequest,
    handleGetFundraisingEventRequest,
    handleUpdateFundraisingEventRequest,
    handleDisableFundraisingEventRequest,
    handleEnableFundraisingEventRequest,
} = require('../../route-handlers/comme');

router.get('/merchantId=:merchantId', handleGetFundraisingEventsRequest);
router.post('/', handleCreateFundraisingEventRequest);
router.get('/id=:id/merchantId=:merchantId', handleGetFundraisingEventRequest);
router.put(
    '/id=:id/merchantId=:merchantId',
    handleUpdateFundraisingEventRequest
);
router.patch(
    '/id=:id/merchantId=:merchantId/status',
    handleDisableFundraisingEventRequest
);
router.patch(
    '/id=:id/merchantId=:merchantId/status',
    handleEnableFundraisingEventRequest
);

module.exports = router;
