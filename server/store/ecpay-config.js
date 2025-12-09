const EcpayConfigModel = require('../model/ecpayConfig');
const sequelize = require('../config/database');
const { Op } = require('sequelize');

async function getEcpayConfigByMerchantId(merchantId) {
    return EcpayConfigModel.findOne({
        where: { merchantId },
    });
}

async function getAllEcpayConfigs() {
    return EcpayConfigModel.findAll({
        where: {
            [Op.or]: [
                sequelize.literal('"youtubeChannelHandle" IS NOT NULL'),
                sequelize.literal('"youtubeChannelId" IS NOT NULL'),
            ],
        },
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
    getAllEcpayConfigs,
    createEcpayConfig,
    getTransaction,
};
