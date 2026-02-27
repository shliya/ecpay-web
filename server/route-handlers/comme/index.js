module.exports = {
    handleGetEcpayRequest: require('./handle-get-ecpay-data'),
    handleCreateEcpaySettingRequest: require('./handle-create-ecpay-setting'),
    handleGetEcpayMerchantRequest: require('./handle-get-ecpay-merchant'),
    handleGetEcpayDonationsRequest: require('./handle-get-ecpay-donation'),
    handleCreateDonateEcpayRequest: require('./handle-create-donate-ecpay'),
    handleResolveDisplayNameRequest: require('./handle-resolve-display-name'),
    handleGetEcpayConfigRequest: require('./handle-get-ecpay-config'),
    handlePatchEcpayConfigRequest: require('./handle-patch-ecpay-config'),
    // PAYUNi相關API
    handleGetPayuniNotifyRequest: require('./handle-get-payuni-notify'),
    handleCreateDonatePayuniRequest: require('./handle-create-donate-payuni'),
};
