const { Op, fn, col } = require('sequelize');
const LargeCrowdfundingDonation = require('../model/schema/large-crowdfunding-donation');

const DEFAULT_RECENT_LIMIT = 50;
const MAX_PAGE_LIMIT = 200;

function normalizeListOpts(opts = {}) {
    const limit = Math.min(
        Math.max(Number(opts.limit) || DEFAULT_RECENT_LIMIT, 1),
        MAX_PAGE_LIMIT
    );
    const offset = Math.max(Number(opts.offset) || 0, 0);
    return { limit, offset };
}

async function findByPaymentTradeNo(paymentTradeNo) {
    const tradeNo = String(paymentTradeNo || '').trim();
    if (!tradeNo) {
        return null;
    }
    return LargeCrowdfundingDonation.findOne({
        where: { paymentTradeNo: tradeNo },
    });
}

/**
 * @returns {Promise<{ row: object }|{ duplicate: true }>}
 */
async function createDonation(row, { transaction } = {}) {
    try {
        const created = await LargeCrowdfundingDonation.create(row, {
            transaction,
        });
        return { row: created };
    } catch (err) {
        if (err && err.name === 'SequelizeUniqueConstraintError') {
            return { duplicate: true };
        }
        throw err;
    }
}

/**
 * @param {bigint|number} pageId
 * @param {{ limit?: number }} [opts]
 */
async function listRecentByPageId(pageId, opts = {}) {
    const { limit, offset } = normalizeListOpts(opts);
    return LargeCrowdfundingDonation.findAll({
        where: { largeCrowdfundingPageId: pageId },
        order: [
            ['amount', 'DESC'],
            ['created_at', 'DESC'],
        ],
        limit,
        offset,
        attributes: ['donorName', 'amount', 'created_at'],
    });
}

/**
 * 依 donorName 合併：同名加總 amount，依加總金額排序（榜單顯示用）。
 * 資料庫仍保留每筆斗內紀錄。
 * @param {string} pageKey
 * @param {{ limit?: number, offset?: number }} [opts]
 */
async function listRecentByPageKey(pageKey, opts = {}) {
    const { limit, offset } = normalizeListOpts(opts);
    return LargeCrowdfundingDonation.findAll({
        where: { pageKey },
        attributes: [
            'donorName',
            [fn('SUM', col('amount')), 'amount'],
            [fn('MAX', col('created_at')), 'created_at'],
        ],
        group: ['donorName'],
        order: [
            [fn('SUM', col('amount')), 'DESC'],
            [fn('MAX', col('created_at')), 'DESC'],
        ],
        limit,
        offset,
        subQuery: false,
        raw: true,
    });
}

/** 榜單上的「人數」（不重複 donorName） */
async function countByPageKey(pageKey) {
    return LargeCrowdfundingDonation.count({
        where: { pageKey },
        distinct: true,
        col: 'donorName',
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
    MAX_PAGE_LIMIT,
    findByPaymentTradeNo,
    createDonation,
    listRecentByPageId,
    listRecentByPageKey,
    countByPageKey,
    sumAmountByPageId,
    isDuplicateWithinWindow,
};
