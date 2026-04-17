const { Op } = require('sequelize');
const donationModel = require('../model/donation');
const sequelize = require('../config/database');
const { ENUM_DONATION_TYPE } = require('../lib/enum');
const { getEcpayConfigByMerchantId } = require('./ecpay-config');
const ecpayConfigModel = require('../model/ecpayConfig');

/** 僅日期 `YYYY-MM-DD`（無時間／時區）時，依 UTC 曆法轉成查詢上下界。 */
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

function normalizeCreatedAtRangeBounds(startDate, endDate) {
    const start = String(startDate ?? '').trim();
    const end = String(endDate ?? '').trim();

    const startBound = DATE_ONLY.test(start)
        ? new Date(`${start}T00:00:00.000Z`)
        : new Date(start);

    const endBound = DATE_ONLY.test(end)
        ? new Date(`${end}T23:59:59.999Z`)
        : new Date(end);

    return [startBound, endBound];
}

async function resolveEcpayConfigId(merchantId) {
    if (!merchantId) return null;
    const config = await getEcpayConfigByMerchantId(merchantId.trim());
    return config ? config.id : null;
}

// TO-DO 轉換成configId，應該拉到common function
async function transferMerchantIdToEcpayConfigId(merchantId) {
    const ecpayConfigId = await resolveEcpayConfigId(merchantId);
    if (ecpayConfigId == null) {
        return null;
    }
    return ecpayConfigId;
}

async function getDonationsByEcpayConfigId(ecpayConfigId) {
    return donationModel.findAll({
        where: { ecpayConfigId },
        include: [
            {
                model: ecpayConfigModel,
                as: 'ecpayConfig',
                attributes: ['blockedKeywords'],
            },
        ],
        order: [['created_at', 'DESC']],
        raw: false,
    });
}

async function getDonationsByEcpayConfigIdAndDate(
    ecpayConfigId,
    { startDate, endDate } = {}
) {
    const [startBound, endBound] = normalizeCreatedAtRangeBounds(
        startDate,
        endDate
    );
    return donationModel.findAll({
        where: {
            ecpayConfigId,
            created_at: { [Op.between]: [startBound, endBound] },
        },
        order: [['created_at', 'DESC']],
        attributes: ['id', 'name', 'cost', 'message', 'created_at', 'type'],
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

async function isDuplicateDonation(merchantId, cost, name) {
    const DEDUP_WINDOW_MS = 60_000;
    const ecpayConfigId = await resolveEcpayConfigId(merchantId);
    if (ecpayConfigId == null) {
        return false;
    }

    const windowStart = new Date(Date.now() - DEDUP_WINDOW_MS);
    const existing = await donationModel.findOne({
        where: {
            ecpayConfigId,
            cost,
            name: name || '',
            created_at: { [Op.gte]: windowStart },
        },
    });

    return !!existing;
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
    getDonationsByEcpayConfigId,
    getDonationsByEcpayConfigIdAndDate,
    createDonation,
    isDuplicateDonation,
    checkDuplicateSuperChat,
    getLastSuperChatTime,

    transferMerchantIdToEcpayConfigId,
};
