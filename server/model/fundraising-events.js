const FundraisingEvents = require('./schema/fundraising-events');
const EcpayConfig = require('./ecpayConfig');

FundraisingEvents.belongsTo(EcpayConfig, {
    foreignKey: 'ecpayConfigId',
    targetKey: 'id',
    as: 'ecpayConfig',
});

module.exports = FundraisingEvents;
