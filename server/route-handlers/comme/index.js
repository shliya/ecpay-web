module.exports = {
    handleGetEcpayRequest: require('./handle-get-ecpay-data'),
    handleCreateEcpaySettingRequest: require('./handle-create-ecpay-setting'),
    handleGetEcpayMerchantRequest: require('./handle-get-ecpay-merchant'),
    handleGetEcpayDonationsRequest: require('./handle-get-ecpay-donation'),
    handleGetFundraisingEventsRequest: require('./handle-get-fundraising-events'),
    handleCreateFundraisingEventRequest: require('./handle-create-fundraising-event'),
    handleGetFundraisingEventRequest: require('./handle-get-fundraising-event'),
    handleUpdateFundraisingEventRequest: require('./handle-update-fundraising-event'),
    handleDisableFundraisingEventRequest: require('./handle-disable-fundraising-event'),
    handleEnableFundraisingEventRequest: require('./handle-enable-fundraising-event'),
};
