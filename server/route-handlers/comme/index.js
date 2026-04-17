module.exports = {
    handleGetEcpayRequest: require('./handle-get-ecpay-data'),
    handleCreateEcpaySettingRequest: require('./handle-create-ecpay-setting'),
    handleGetEcpayMerchantRequest: require('./handle-get-ecpay-merchant'),
    handleGetEcpayDonationsRequest: require('./handle-get-ecpay-donation'),
    handleGetEcpayDonationsByStartDateEndDateRequest: require('./handle-get-ecpay-donations-by-date-request'),
    handleCreateDonateEcpayRequest: require('./handle-create-donate-ecpay'),
    handleResolveDisplayNameRequest: require('./handle-resolve-display-name'),
    handleGetEcpayConfigRequest: require('./handle-get-ecpay-config'),
    handleGetEcpayConfigPublicRequest: require('./handle-get-ecpay-config-public'),
    handlePatchEcpayConfigRequest: require('./handle-patch-ecpay-config'),
    handlePatchEcpayThemeRequest: require('./handle-patch-ecpay-theme'),
    // PAYUNi相關API
    handleGetPayuniNotifyRequest: require('./handle-get-payuni-notify'),
    handleCreateDonatePayuniRequest: require('./handle-create-donate-payuni'),
    handleCreatePayuniSettingRequest: require('./handle-create-payuni-setting'),
};
