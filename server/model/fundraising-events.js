const FundraisingEvents = require('./schema/fundraising-events');
const EcpayConfig = require('./ecpayConfig');

FundraisingEvents.belongsTo(EcpayConfig, {
    foreignKey: 'merchantId',
    targetKey: 'merchantId',
    as: 'ecpayConfig',
});

module.exports = FundraisingEvents;
