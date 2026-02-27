const EcpayConfig = require('./schema/ecpayConfig');
const IchibanEvent = require('./schema/ichiban-event');
const Donation = require('./schema/donation');

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

module.exports = EcpayConfig;
