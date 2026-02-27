const { Op } = require('sequelize');
const donationModel = require('../model/donation');
const sequelize = require('../config/database');
const { ENUM_DONATION_TYPE } = require('../lib/enum');
const { getEcpayConfigByMerchantId } = require('./ecpay-config');

async function resolveEcpayConfigId(merchantId) {
    if (!merchantId) return null;
    const config = await getEcpayConfigByMerchantId(merchantId.trim());
    return config ? config.id : null;
}

async function getDonationsByMerchantId(merchantId) {
    const ecpayConfigId = await resolveEcpayConfigId(merchantId);
    if (ecpayConfigId == null) return [];
    return getDonationsByEcpayConfigId(ecpayConfigId);
}

async function getDonationsByEcpayConfigId(ecpayConfigId) {
    return donationModel.findAll({
        where: { ecpayConfigId },
        order: [['created_at', 'DESC']],
    });
}

async function getDonationsByMerchantIdAndDate(
    merchantId,
    { startDate, endDate } = {}
) {
    const ecpayConfigId = await resolveEcpayConfigId(merchantId);
    if (ecpayConfigId == null) return [];
    return getDonationsByEcpayConfigIdAndDate(ecpayConfigId, {
        startDate,
        endDate,
    });
}

async function getDonationsByEcpayConfigIdAndDate(
    ecpayConfigId,
    { startDate, endDate } = {}
) {
    return donationModel.findAll({
        where: {
            ecpayConfigId,
            created_at: { [Op.between]: [startDate, endDate] },
        },
        order: [['created_at', 'DESC']],
    });
}

async function getLastSuperChatTime(merchantId) {
    const ecpayConfigId = await resolveEcpayConfigId(merchantId);
    if (ecpayConfigId == null) return null;
    const lastDonation = await donationModel.findOne({
        where: {
            ecpayConfigId,
            type: ENUM_DONATION_TYPE.YOUTUBE_SUPER_CHAT,
        },
        order: [['created_at', 'DESC']],
    });

    return lastDonation ? lastDonation.created_at : null;
}

async function checkDuplicateSuperChat(
    merchantId,
    name,
    cost,
    message,
    publishedAt
) {
    if (!publishedAt) {
        return false;
    }

    const ecpayConfigId = await resolveEcpayConfigId(merchantId);
    if (ecpayConfigId == null) return false;

    const publishedDate = new Date(publishedAt);
    const timeWindowStart = new Date(publishedDate.getTime() - 60000);
    const timeWindowEnd = new Date(publishedDate.getTime() + 60000);

    const existingDonation = await donationModel.findOne({
        where: {
            ecpayConfigId,
            type: ENUM_DONATION_TYPE.YOUTUBE_SUPER_CHAT,
            name,
            cost,
            message: message || '',
            created_at: {
                [Op.between]: [timeWindowStart, timeWindowEnd],
            },
        },
    });

    return !!existingDonation;
}

async function createDonation(row, { transaction } = {}) {
    const resolved = { ...row };
    if (resolved.ecpayConfigId == null && resolved.merchantId) {
        const id = await resolveEcpayConfigId(resolved.merchantId);
        if (id != null) resolved.ecpayConfigId = id;
    }
    return donationModel.create(resolved, { transaction });
}

function getTransaction() {
    return sequelize.transaction();
}

module.exports = {
    getTransaction,
    getDonationsByMerchantId,
    getDonationsByEcpayConfigId,
    getDonationsByMerchantIdAndDate,
    getDonationsByEcpayConfigIdAndDate,
    createDonation,
    checkDuplicateSuperChat,
    getLastSuperChatTime,
};
