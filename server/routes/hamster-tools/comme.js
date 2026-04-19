const express = require('express');
const router = new express.Router();
const registrationRateLimiter = require('../../middleware/rate-limit-registration');
const loginRateLimiter = require('../../middleware/rate-limit-login');
const requireTotp = require('../../middleware/require-totp');
const { beforeCheckTestAccount } = require('../../route-hooks/comme');
const {
    handleGetEcpayRequest,
    handleCreateEcpaySettingRequest,
    handleGetEcpayMerchantRequest,
    handleGetEcpayDonationsRequest,
    handleGetEcpayDonationsByStartDateEndDateRequest,
    handleGetEcpayConfigRequest,
    handleGetEcpayConfigPublicRequest,
    handlePatchEcpayConfigRequest,
    handleCreateDonateEcpayRequest,
    handleResolveDisplayNameRequest,
    handleGetPayuniNotifyRequest,
    handleCreateDonatePayuniRequest,
    handleCreatePayuniSettingRequest,
    handlePatchEcpayThemeRequest,
} = require('../../route-handlers/comme');

//綠界notify回調
router.post('/ecpay/id=:merchantId', handleGetEcpayRequest);

//建立綠界商店設定
router.post(
    '/ecpay/setting',
    registrationRateLimiter,
    handleCreateEcpaySettingRequest
);

//建立PAYUNi商店設定
router.post(
    '/payuni/setting',
    registrationRateLimiter,
    handleCreatePayuniSettingRequest
);

//取得商戶是否存在（供 donate-list 等已登入頁面使用，不含 rate limit）
router.get(
    '/ecpay/check-merchant/id=:merchantId',
    handleGetEcpayMerchantRequest
);

router.get('/ecpay/donations/id=:merchantId', handleGetEcpayDonationsRequest);
router.get(
    '/ecpay/config/public/id=:merchantId',
    handleGetEcpayConfigPublicRequest
);
router.get(
    '/ecpay/donations/startDate=:startDate/endDate=:endDate/id=:merchantId',
    handleGetEcpayDonationsByStartDateEndDateRequest
);
router.get(
    '/ecpay/config/id=:merchantId',
    requireTotp,
    loginRateLimiter,
    handleGetEcpayConfigRequest
);
router.patch(
    '/ecpay/config/id=:merchantId',
    beforeCheckTestAccount,
    loginRateLimiter,
    requireTotp,
    handlePatchEcpayConfigRequest
);
router.patch('/ecpay/theme/id=:merchantId', handlePatchEcpayThemeRequest);
router.post('/donate/ecpay', loginRateLimiter, handleCreateDonateEcpayRequest);

router.post('/payuni/id=:merchantId', handleGetPayuniNotifyRequest);
router.post(
    '/donate/payuni',
    loginRateLimiter,
    handleCreateDonatePayuniRequest
);

router.get('/resolve-name', handleResolveDisplayNameRequest);

module.exports = router;
