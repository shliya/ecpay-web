const express = require('express');
const router = new express.Router();
const loginRateLimiter = require('../../middleware/rate-limit-login');
const handleGetEcpayMerchantRequest = require('../../route-handlers/comme/handle-get-ecpay-merchant');
const handleSetupTotp = require('../../route-handlers/login/handle-setup-totp');
const handleConfirmTotp = require('../../route-handlers/login/handle-confirm-totp');
const handleVerifyTotp = require('../../route-handlers/login/handle-verify-totp');

router.get(
    '/check-merchant/id=:merchantId',
    loginRateLimiter,
    handleGetEcpayMerchantRequest
);

router.post('/setup-totp', loginRateLimiter, handleSetupTotp);
router.post('/confirm-totp', loginRateLimiter, handleConfirmTotp);
router.post('/verify-totp', loginRateLimiter, handleVerifyTotp);

module.exports = router;
