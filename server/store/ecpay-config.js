const EcpayConfigModel = require('../model/ecpayConfig');
const sequelize = require('../config/database');
const { Op } = require('sequelize');

async function getEcpayConfigByMerchantId(merchantId) {
    return EcpayConfigModel.findOne({
        where: { merchantId },
    });
}

async function getEcpayConfigByDisplayName(displayName) {
    if (!displayName || typeof displayName !== 'string') return null;
    const name = displayName.trim();
    if (!name) return null;
    return EcpayConfigModel.findOne({
        where: { displayName: name },
        attributes: ['merchantId', 'displayName'],
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

async function updateThemeColors(merchantId, themeColors) {
    const row = await EcpayConfigModel.findOne({
        where: { merchantId: merchantId.trim() },
    });
    if (!row) return null;
    await row.update({ themeColors: themeColors || null });
    return row;
}

function getTransaction() {
    return sequelize.transaction();
}

module.exports = {
    getEcpayConfigByMerchantId,
    getEcpayConfigByDisplayName,
    getAllEcpayConfigs,
    createEcpayConfig,
    updateThemeColors,
    getTransaction,
};
