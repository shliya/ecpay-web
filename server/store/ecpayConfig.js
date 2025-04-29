const EcpayConfigModel = require('../model/ecpayConfig');

async function getEcpayConfigByMerchantId(merchantId) {
    return EcpayConfigModel.findOne({
        where: { merchantId },
    });
}

async function createEcpayConfig(row, { transaction }) {
    return EcpayConfigModel.create(row, { transaction });
}

module.exports = {
    getEcpayConfigByMerchantId,
    createEcpayConfig,
};
