const EcpayConfigModel = require('../model/ecpayConfig');
const sequelize = require('../config/database');
const { Op } = require('sequelize');

async function getEcpayConfigByMerchantId(merchantId) {
    if (!merchantId || typeof merchantId !== 'string') return null;
    const trimmed = merchantId.trim();
    let config = await EcpayConfigModel.findOne({
        where: { merchantId: trimmed },
    });
    if (!config) {
        config = await EcpayConfigModel.findOne({
            where: { payuniMerchantId: trimmed },
        });
    }
    return config;
}

async function getPayuniMerchantIdByMerchantId(merchantId) {
    return EcpayConfigModel.findOne({
        where: { merchantId },
        attributes: ['payuniMerchantId'],
        raw: true,
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

async function updateEcpayConfig(merchantId, updateData) {
    const row = await EcpayConfigModel.findOne({
        where: { merchantId: merchantId.trim() },
    });
    if (!row) return null;

    if (Object.keys(updateData).length === 0) {
        return row;
    }

    await row.update(updateData);
    return row;
}

function getTransaction() {
    return sequelize.transaction();
}

async function getPayuniConfigByPayuniMerchantId(
    payuniMerchantId,
    { properties }
) {
    return EcpayConfigModel.findOne({
        where: { payuniMerchantId },
        attributes: properties,
        raw: true,
    });
}

module.exports = {
    getEcpayConfigByMerchantId,
    getEcpayConfigByDisplayName,
    getAllEcpayConfigs,
    createEcpayConfig,
    updateThemeColors,
    updateEcpayConfig,
    getTransaction,
    getPayuniConfigByPayuniMerchantId,
    getPayuniMerchantIdByMerchantId,
};
