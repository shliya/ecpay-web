const express = require('express');
const router = new express.Router();
const {
    handlePaymentSuccessRequest,
    handlePaymentFailedRequest,
    handleOpaySuccessRequest,
} = require('../../route-handlers/payment');
router.post('/ecpay-success', handlePaymentSuccessRequest);
router.post('/ecpay-failed', handlePaymentFailedRequest);
router.post('/opay-success', handleOpaySuccessRequest);
module.exports = router;
