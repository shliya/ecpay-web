const express = require('express');
const router = new express.Router();
const requireMerchantAuth = require('../../middleware/require-merchant-auth');
const { safeEqualString } = require('../../lib/safe-equal');
const {
    handleGetFundraisingEventsRequest,
    handleCreateFundraisingEventRequest,
    handleGetFundraisingEventRequest,
    handleUpdateFundraisingEventRequest,
    handleDisableFundraisingEventRequest,
    handleEnableFundraisingEventRequest,
    handleExpireEventsRequest,
    handlePauseFundraisingEventRequest,
} = require('../../route-handlers/fundraising-event');

function requireInternalApiKey(req, res, next) {
    const apiKey = String(req.headers['x-api-key'] || '').trim();
    const expected = String(process.env.INTERNAL_API_KEY || '').trim();
    if (!expected || !apiKey || !safeEqualString(apiKey, expected)) {
        return res.status(403).json({ error: '未授權的存取' });
    }
    next();
}

router.get('/merchantId=:merchantId', handleGetFundraisingEventsRequest);
router.get('/id=:id/merchantId=:merchantId', handleGetFundraisingEventRequest);

router.post('/', requireMerchantAuth, handleCreateFundraisingEventRequest);
router.patch(
    '/id=:id/merchantId=:merchantId',
    requireMerchantAuth,
    handleUpdateFundraisingEventRequest
);
router.patch(
    '/id=:id/merchantId=:merchantId/status',
    requireMerchantAuth,
    handleDisableFundraisingEventRequest
);
router.patch(
    '/id=:id/merchantId=:merchantId/status/enable',
    requireMerchantAuth,
    handleEnableFundraisingEventRequest
);
router.patch(
    '/id=:id/merchantId=:merchantId/status/pause',
    requireMerchantAuth,
    handlePauseFundraisingEventRequest
);

router.post('/expire-check', requireInternalApiKey, handleExpireEventsRequest);

module.exports = router;
