const express = require('express');
const router = new express.Router();
const {
    handlePaymentSuccessRequest,
    handlePaymentFailedRequest,
} = require('../../route-handlers/payment');
router.post('/ecpay-success', handlePaymentSuccessRequest);
router.post('/ecpay-failed', handlePaymentFailedRequest);
module.exports = router;
