const express = require('express');
const router = new express.Router();
const loginRateLimiter = require('../../middleware/rate-limit-login');
const handleGetEcpayMerchantRequest = require('../../route-handlers/comme/handle-get-ecpay-merchant');

router.get(
    '/check-merchant/id=:merchantId',
    loginRateLimiter,
    handleGetEcpayMerchantRequest
);

module.exports = router;
