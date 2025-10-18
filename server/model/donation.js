const Donation = require('./schema/donation');
const EcpayConfig = require('./ecpayConfig');

Donation.belongsTo(EcpayConfig, {
    foreignKey: 'merchantId',
    targetKey: 'merchantId',
    as: 'ecpayConfig',
});

module.exports = Donation;
