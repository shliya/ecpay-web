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

/** Phase 2：大型募資落地頁 CRUD（目前回傳 501，前端改讀 static / localStorage） */
function handleCrowdfundingApiStub(_req, res) {
    res.status(501).json({
        ok: false,
        message: 'Crowdfunding page API not implemented (Phase 2)',
    });
}

router.get(
    '/crowdfunding/id=:merchantId/pageKey=:pageKey',
    requireTotp,
    handleCrowdfundingApiStub
);
router.put(
    '/crowdfunding/id=:merchantId/pageKey=:pageKey',
    requireTotp,
    handleCrowdfundingApiStub
);
router.post(
    '/crowdfunding/id=:merchantId/pageKey=:pageKey/publish',
    requireTotp,
    handleCrowdfundingApiStub
);
router.get(
    '/crowdfunding/donors/pageKey=:pageKey',
    handleCrowdfundingApiStub
);

module.exports = router;
