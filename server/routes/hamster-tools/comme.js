const express = require('express');
const router = new express.Router();
const {
    beforeGetEcpayRequest,
    beforeCreateEcpaySettingRequest,
} = require('../../route-hooks/comme');
const {
    handleGetEcpayRequest,
    handleCreateEcpaySettingRequest,
    handleGetEcpayMerchantRequest,
    handleGetEcpayDonationsRequest,
    handleGetEcpayConfigRequest,
    handlePatchEcpayConfigRequest,
    handleCreateDonateEcpayRequest,
    handleResolveDisplayNameRequest,
    handleGetPayuniNotifyRequest,
    handleCreateDonatePayuniRequest,
    handleCreatePayuniSettingRequest,
} = require('../../route-handlers/comme');

//綠界notify回調
router.post(
    '/ecpay/id=:merchantId',
    beforeGetEcpayRequest,
    handleGetEcpayRequest
);

//建立綠界商店設定
router.post(
    '/ecpay/setting',
    beforeCreateEcpaySettingRequest,
    handleCreateEcpaySettingRequest
);

//建立PAYUNi商店設定
router.post('/payuni/setting', handleCreatePayuniSettingRequest);

//取得商戶是否存在
router.get(
    '/ecpay/check-merchant/id=:merchantId',
    handleGetEcpayMerchantRequest
);
//綠界相關API
router.get('/ecpay/donations/id=:merchantId', handleGetEcpayDonationsRequest);
router.get('/ecpay/config/id=:merchantId', handleGetEcpayConfigRequest);
router.patch('/ecpay/config/id=:merchantId', handlePatchEcpayConfigRequest);
router.post('/donate/ecpay', handleCreateDonateEcpayRequest);

//PAYUNi notify回調
router.post('/payuni/id=:merchantId', handleGetPayuniNotifyRequest);
router.post('/donate/payuni', handleCreateDonatePayuniRequest);

router.get('/resolve-name', handleResolveDisplayNameRequest);

module.exports = router;
