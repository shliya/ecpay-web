const EcpayConfigModel = require('../model/ecpayConfig');
const sequelize = require('../config/database');

async function getEcpayConfigByMerchantId(merchantId) {
    return EcpayConfigModel.findOne({
        where: { merchantId },
    });
}

async function createEcpayConfig(row, { transaction }) {
    return EcpayConfigModel.create(row, { transaction });
}

function getTransaction() {
    return sequelize.transaction();
}

module.exports = {
    getEcpayConfigByMerchantId,
    createEcpayConfig,
    getTransaction,
};
