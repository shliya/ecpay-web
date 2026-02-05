/**
 * @deprecated Use server/lib/payment-providers/ecpay.js instead.
 * This file re-exports for backward compatibility.
 */
const {
    getEcPayDonations,
    createPayment,
} = require('./payment-providers/ecpay');

module.exports = {
    getEcPayDonations,
    createPayment,
};
