const EcpayConfig = require('./schema/ecpayConfig');
const IchibanEvent = require('./schema/ichiban-event');
const Donation = require('./schema/donation');
const FundraisingEvents = require('./schema/fundraising-events');

EcpayConfig.hasMany(IchibanEvent, {
    foreignKey: 'merchantId',
    sourceKey: 'merchantId',
    as: 'ichibanEvents',
    constraints: false, // 禁用外鍵約束
});

EcpayConfig.hasMany(Donation, {
    foreignKey: 'ecpayConfigId',
    sourceKey: 'id',
    as: 'donations',
    constraints: false, // 禁用外鍵約束
});

EcpayConfig.hasMany(FundraisingEvents, {
    foreignKey: 'ecpayConfigId',
    sourceKey: 'id',
    as: 'fundraisingEvents',
    constraints: false,
});

module.exports = EcpayConfig;
