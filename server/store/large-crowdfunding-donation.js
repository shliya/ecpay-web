const { Op } = require('sequelize');
const LargeCrowdfundingDonation = require('../model/schema/large-crowdfunding-donation');

const DEFAULT_RECENT_LIMIT = 50;

async function createDonation(row, { transaction } = {}) {
    return LargeCrowdfundingDonation.create(row, { transaction });
}

/**
 * @param {bigint|number} pageId
 * @param {{ limit?: number }} [opts]
 */
async function listRecentByPageId(pageId, opts = {}) {
    const limit = Math.min(Math.max(Number(opts.limit) || DEFAULT_RECENT_LIMIT, 1), 200);
    return LargeCrowdfundingDonation.findAll({
        where: { largeCrowdfundingPageId: pageId },
        order: [
            ['amount', 'DESC'],
            ['created_at', 'DESC'],
        ],
        limit,
        attributes: ['donorName', 'amount', 'created_at'],
    });
}

/**
 * @param {string} pageKey
 * @param {{ limit?: number }} [opts]
 */
async function listRecentByPageKey(pageKey, opts = {}) {
    const limit = Math.min(Math.max(Number(opts.limit) || DEFAULT_RECENT_LIMIT, 1), 200);
    return LargeCrowdfundingDonation.findAll({
        where: { pageKey },
        order: [
            ['amount', 'DESC'],
            ['created_at', 'DESC'],
        ],
        limit,
        attributes: ['donorName', 'amount', 'created_at'],
    });
}

async function sumAmountByPageId(pageId, { transaction } = {}) {
    const total = await LargeCrowdfundingDonation.sum('amount', {
        where: { largeCrowdfundingPageId: pageId },
        transaction,
    });
    const n = Number(total);
    return Number.isFinite(n) ? n : 0;
}

async function isDuplicateWithinWindow(
    pageId,
    donorName,
    amount,
    windowMs = 60_000
) {
    const windowStart = new Date(Date.now() - windowMs);
    const existing = await LargeCrowdfundingDonation.findOne({
        where: {
            largeCrowdfundingPageId: pageId,
            donorName: donorName || '',
            amount,
            created_at: { [Op.gte]: windowStart },
        },
    });
    return !!existing;
}

module.exports = {
    DEFAULT_RECENT_LIMIT,
    createDonation,
    listRecentByPageId,
    listRecentByPageKey,
    sumAmountByPageId,
    isDuplicateWithinWindow,
};
