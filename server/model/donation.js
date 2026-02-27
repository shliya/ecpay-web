const Donation = require('./schema/donation');
const EcpayConfig = require('./ecpayConfig');

Donation.belongsTo(EcpayConfig, {
    foreignKey: 'ecpayConfigId',
    targetKey: 'id',
    as: 'ecpayConfig',
});

module.exports = Donation;
