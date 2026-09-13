const express = require('express');
const router = new express.Router();
const registrationRateLimiter = require('../../middleware/rate-limit-registration');
const loginRateLimiter = require('../../middleware/rate-limit-login');
const requireMerchantAuth = require('../../middleware/require-merchant-auth');
const { beforeCheckTestAccount } = require('../../route-hooks/comme');
const {
    handleGetEcpayRequest,
    handleCreateEcpaySettingRequest,
    handleGetEcpayMerchantRequest,
    handleGetEcpayDonationsRequest,
    handleGetEcpayDonationsPublicRequest,
    handleGetEcpayDonationsByStartDateEndDateRequest,
    handleGetEcpayConfigRequest,
    handleGetEcpayConfigPublicRequest,
    handlePatchEcpayConfigRequest,
    handleCreateDonateEcpayRequest,
    handleResolveDisplayNameRequest,
    handleGetPayuniNotifyRequest,
    handleCreateDonatePayuniRequest,
    handleCreateDonateOpayRequest,
    handleCreatePayuniSettingRequest,
    handlePatchEcpayThemeRequest,
    handleListCrowdfundingPagesRequest,
    handleGetCrowdfundingPageRequest,
    handleGetCrowdfundingPagePublicRequest,
    handlePutCrowdfundingPageRequest,
    handlePublishCrowdfundingPageRequest,
    handleDeleteCrowdfundingPageRequest,
    handleGetCrowdfundingDonorsRequest,
    handleGetCrowdfundingDonorsTenRequest,
    handleGetCrowdfundingDonorsSpecialRequest,
    handleGetLcfPaymentConfigRequest,
    handlePatchLcfPaymentConfigRequest,
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

//公開斗內列表（不需 TOTP，供 donate-list 等公開頁面使用；僅回傳展示欄位）
router.get(
    '/ecpay/donations/public/id=:merchantId',
    handleGetEcpayDonationsPublicRequest
);
router.get(
    '/ecpay/donations/id=:merchantId',
    requireMerchantAuth,
    handleGetEcpayDonationsRequest
);
router.get(
    '/ecpay/config/public/id=:merchantId',
    handleGetEcpayConfigPublicRequest
);
router.get(
    '/ecpay/donations/startDate=:startDate/endDate=:endDate/id=:merchantId',
    requireMerchantAuth,
    handleGetEcpayDonationsByStartDateEndDateRequest
);
router.get(
    '/ecpay/config/id=:merchantId',
    requireMerchantAuth,
    loginRateLimiter,
    handleGetEcpayConfigRequest
);
router.patch(
    '/ecpay/config/id=:merchantId',
    beforeCheckTestAccount,
    loginRateLimiter,
    requireMerchantAuth,
    handlePatchEcpayConfigRequest
);
router.patch(
    '/ecpay/theme/id=:merchantId',
    requireMerchantAuth,
    handlePatchEcpayThemeRequest
);
router.post('/donate/ecpay', loginRateLimiter, handleCreateDonateEcpayRequest);

router.post('/payuni/id=:merchantId', handleGetPayuniNotifyRequest);
router.post(
    '/donate/payuni',
    loginRateLimiter,
    handleCreateDonatePayuniRequest
);
router.post('/donate/opay', loginRateLimiter, handleCreateDonateOpayRequest);

router.get('/resolve-name', handleResolveDisplayNameRequest);

/** Phase 2：大型募資落地頁 */
router.get(
    '/crowdfunding/pageKey=:pageKey',
    handleGetCrowdfundingPagePublicRequest
);
router.get(
    '/crowdfunding/public/pageKey=:pageKey',
    handleGetCrowdfundingPagePublicRequest
);
router.get(
    '/crowdfunding/public/id=:merchantId/pageKey=:pageKey',
    handleGetCrowdfundingPagePublicRequest
);
router.get(
    '/crowdfunding/donors/pageKey=:pageKey',
    handleGetCrowdfundingDonorsRequest
);
router.get(
    '/crowdfunding/donors/pageKey=:pageKey/ten',
    handleGetCrowdfundingDonorsTenRequest
);
router.get(
    '/crowdfunding/donors/pageKey=:pageKey/special',
    handleGetCrowdfundingDonorsSpecialRequest
);
router.get(
    '/crowdfunding/id=:merchantId',
    requireMerchantAuth,
    handleListCrowdfundingPagesRequest
);
router.get(
    '/crowdfunding/payment-config/id=:merchantId',
    requireMerchantAuth,
    handleGetLcfPaymentConfigRequest
);
router.patch(
    '/crowdfunding/payment-config/id=:merchantId',
    requireMerchantAuth,
    handlePatchLcfPaymentConfigRequest
);
router.get(
    '/crowdfunding/id=:merchantId/pageKey=:pageKey',
    requireMerchantAuth,
    handleGetCrowdfundingPageRequest
);
router.put(
    '/crowdfunding/id=:merchantId/pageKey=:pageKey',
    requireMerchantAuth,
    handlePutCrowdfundingPageRequest
);
router.post(
    '/crowdfunding/id=:merchantId/pageKey=:pageKey/publish',
    requireMerchantAuth,
    handlePublishCrowdfundingPageRequest
);
router.delete(
    '/crowdfunding/id=:merchantId/pageKey=:pageKey',
    requireMerchantAuth,
    handleDeleteCrowdfundingPageRequest
);

module.exports = router;
