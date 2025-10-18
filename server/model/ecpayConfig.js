const EcpayConfig = require('./schema/ecpayConfig');
const IchibanEvent = require('./schema/ichiban-event');
const Donation = require('./schema/donation');

EcpayConfig.hasMany(IchibanEvent, {
    foreignKey: 'merchantId',
    sourceKey: 'merchantId',
    as: 'ichibanEvents',
});

EcpayConfig.hasMany(Donation, {
    foreignKey: 'merchantId',
    sourceKey: 'merchantId',
    as: 'donations',
});

module.exports = EcpayConfig;
