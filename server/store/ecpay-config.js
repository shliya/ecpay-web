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
                {
                    youtubeChannelHandle: {
                        [Op.ne]: null,
                    },
                },
                {
                    youtubeChannelId: {
                        [Op.ne]: null,
                    },
                },
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
