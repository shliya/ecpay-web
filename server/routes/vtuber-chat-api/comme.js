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

module.exports = router;
