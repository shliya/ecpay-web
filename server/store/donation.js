const { Op } = require('sequelize');
const donationModel = require('../model/donation');
const sequelize = require('../config/database');
const { ENUM_DONATION_TYPE } = require('../lib/enum');

async function getDonationsByMerchantId(merchantId) {
    return donationModel.findAll({
        where: { merchantId },
        order: [['created_at', 'DESC']],
    });
}

async function getDonationsByMerchantIdAndDate(
    merchantId,
    { startDate, endDate } = {}
) {
    return donationModel.findAll({
        where: {
            merchantId,
            created_at: { [Op.between]: [startDate, endDate] },
        },
        order: [['created_at', 'DESC']],
    });
}

async function getLastSuperChatTime(merchantId) {
    const lastDonation = await donationModel.findOne({
        where: {
            merchantId,
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

    const publishedDate = new Date(publishedAt);
    const timeWindowStart = new Date(publishedDate.getTime() - 60000);
    const timeWindowEnd = new Date(publishedDate.getTime() + 60000);

    const existingDonation = await donationModel.findOne({
        where: {
            merchantId,
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
    return donationModel.create(row, { transaction });
}

function getTransaction() {
    return sequelize.transaction();
}

module.exports = {
    getTransaction,
    getDonationsByMerchantId,
    getDonationsByMerchantIdAndDate,
    createDonation,
    checkDuplicateSuperChat,
    getLastSuperChatTime,
};
