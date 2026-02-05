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
    handlePatchEcpayThemeRequest,
    handleCreateDonateEcpayRequest,
    handleResolveDisplayNameRequest,
} = require('../../route-handlers/comme');

router.post(
    '/ecpay/id=:merchantId',
    beforeGetEcpayRequest,
    handleGetEcpayRequest
);

router.post(
    '/ecpay/setting',
    beforeCreateEcpaySettingRequest,
    handleCreateEcpaySettingRequest
);

router.get(
    '/ecpay/check-merchant/id=:merchantId',
    handleGetEcpayMerchantRequest
);

router.get('/ecpay/donations/id=:merchantId', handleGetEcpayDonationsRequest);

router.get('/ecpay/config/id=:merchantId', handleGetEcpayConfigRequest);
router.patch('/ecpay/config/id=:merchantId', handlePatchEcpayThemeRequest);

router.post('/donate/ecpay', handleCreateDonateEcpayRequest);

router.get('/resolve-name', handleResolveDisplayNameRequest);

module.exports = router;
