const express = require('express');
const router = new express.Router();
const requireTotp = require('../../middleware/require-totp');
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

router.post('/', requireTotp, handleCreateFundraisingEventRequest);
router.patch(
    '/id=:id/merchantId=:merchantId',
    requireTotp,
    handleUpdateFundraisingEventRequest
);
router.patch(
    '/id=:id/merchantId=:merchantId/status',
    requireTotp,
    handleDisableFundraisingEventRequest
);
router.patch(
    '/id=:id/merchantId=:merchantId/status/enable',
    requireTotp,
    handleEnableFundraisingEventRequest
);
router.patch(
    '/id=:id/merchantId=:merchantId/status/pause',
    requireTotp,
    handlePauseFundraisingEventRequest
);

router.post(
    '/expire-check',
    requireInternalApiKey,
    handleExpireEventsRequest
);

module.exports = router;
