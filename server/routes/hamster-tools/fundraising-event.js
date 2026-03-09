const express = require('express');
const router = new express.Router();
const {
    handleGetFundraisingEventsRequest,
    handleCreateFundraisingEventRequest,
    handleGetFundraisingEventRequest,
    handleUpdateFundraisingEventRequest,
    handleUpdateFundraisingEventCostRequest,
    handleDisableFundraisingEventRequest,
    handleEnableFundraisingEventRequest,
    handleExpireEventsRequest,
    handlePauseFundraisingEventRequest,
} = require('../../route-handlers/fundraising-event');

router.get('/merchantId=:merchantId', handleGetFundraisingEventsRequest);
router.post('/', handleCreateFundraisingEventRequest);
router.get('/id=:id/merchantId=:merchantId', handleGetFundraisingEventRequest);
router.patch(
    '/id=:id/merchantId=:merchantId',
    handleUpdateFundraisingEventRequest
);
router.put(
    '/id=:id/merchantId=:merchantId/cost',
    handleUpdateFundraisingEventCostRequest
);
router.patch(
    '/id=:id/merchantId=:merchantId/status',
    handleDisableFundraisingEventRequest
);
router.patch(
    '/id=:id/merchantId=:merchantId/status/enable',
    handleEnableFundraisingEventRequest
);
router.patch(
    '/id=:id/merchantId=:merchantId/status/pause',
    handlePauseFundraisingEventRequest
);

router.post(
    '/expire-check',
    (req, res, next) => {
        const apiKey = req.headers['x-api-key'];
        if (!apiKey || apiKey !== process.env.INTERNAL_API_KEY) {
            return res.status(403).json({ error: '未授權的存取' });
        }
        next();
    },
    handleExpireEventsRequest
);

module.exports = router;
