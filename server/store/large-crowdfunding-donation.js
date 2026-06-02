const { Op, QueryTypes } = require('sequelize');
const LargeCrowdfundingDonation = require('../model/schema/large-crowdfunding-donation');

const DEFAULT_RECENT_LIMIT = 50;
const MAX_PAGE_LIMIT = 200;

/** 特殊主題榜：累計達標門檻（元） */
const SPECIAL_THEME_THRESHOLD_AMOUNT = 21210;
/** 特殊主題榜：最快達標名額 */
const SPECIAL_THEME_LEADERBOARD_LIMIT = 4;

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
 * 依 donorName 合併：同名加總 amount（榜十／榜單顯示用）。
 * 排序：累計金額 DESC；同額時依「首次達到目前累計總額」時間 ASC（先達標者在前）。
 * 若之後加碼超過他人則因金額較高而往前，不受 tie-break 影響。
 * @param {string} pageKey
 * @param {{ limit?: number, offset?: number }} [opts]
 */
async function listRecentByPageKey(pageKey, opts = {}) {
    const { limit, offset } = normalizeListOpts(opts);
    return LargeCrowdfundingDonation.sequelize.query(
        `
        WITH donations AS (
            SELECT id, "donorName", amount, created_at
            FROM large_crowdfunding_donations
            WHERE "pageKey" = :pageKey
        ),
        running AS (
            SELECT
                id,
                "donorName",
                created_at,
                SUM(amount) OVER (
                    PARTITION BY "donorName"
                    ORDER BY created_at ASC, id ASC
                ) AS running_total
            FROM donations
        ),
        totals AS (
            SELECT "donorName", SUM(amount)::int AS amount
            FROM donations
            GROUP BY "donorName"
        ),
        first_reached AS (
            SELECT DISTINCT ON (r."donorName")
                r."donorName",
                r.created_at AS reached_at
            FROM running r
            INNER JOIN totals t ON t."donorName" = r."donorName"
            WHERE r.running_total >= t.amount
            ORDER BY r."donorName", r.created_at ASC, r.id ASC
        )
        SELECT
            fr."donorName",
            t.amount,
            fr.reached_at AS created_at
        FROM first_reached fr
        INNER JOIN totals t ON t."donorName" = fr."donorName"
        ORDER BY t.amount DESC, fr.reached_at ASC
        LIMIT :limit OFFSET :offset
        `,
        {
            replacements: { pageKey, limit, offset },
            type: QueryTypes.SELECT,
        }
    );
}

/**
 * 特殊主題榜：同名累計達門檻後，依「達標當下」created_at 取最快的前 N 名。
 * 第 5 名以後達標者不列入（即使後來金額更高）。
 * @param {string} pageKey
 * @param {{ thresholdAmount?: number, limit?: number }} [opts]
 * @returns {Promise<Array<{ donorName: string, amount: number, created_at: Date }>>}
 */
async function listSpecialDonationsByPageKey(pageKey, opts = {}) {
    const threshold =
        Number(opts.thresholdAmount) > 0 ?
            Math.floor(Number(opts.thresholdAmount))
        :   SPECIAL_THEME_THRESHOLD_AMOUNT;
    const limit = Math.min(
        Math.max(
            Math.floor(Number(opts.limit)) || SPECIAL_THEME_LEADERBOARD_LIMIT,
            1
        ),
        SPECIAL_THEME_LEADERBOARD_LIMIT
    );

    const rows = await LargeCrowdfundingDonation.sequelize.query(
        `
        WITH donations AS (
            SELECT
                id,
                "donorName",
                amount,
                created_at
            FROM large_crowdfunding_donations
            WHERE "pageKey" = :pageKey
        ),
        running AS (
            SELECT
                id,
                "donorName",
                amount,
                created_at,
                SUM(amount) OVER (
                    PARTITION BY "donorName"
                    ORDER BY created_at ASC, id ASC
                ) AS running_total
            FROM donations
        ),
        first_reached AS (
            SELECT DISTINCT ON ("donorName")
                "donorName",
                created_at AS reached_at
            FROM running
            WHERE running_total >= :threshold
            ORDER BY "donorName", created_at ASC, id ASC
        ),
        totals AS (
            SELECT "donorName", SUM(amount)::int AS amount
            FROM donations
            GROUP BY "donorName"
        )
        SELECT
            fr."donorName",
            t.amount,
            fr.reached_at AS created_at
        FROM first_reached fr
        INNER JOIN totals t ON t."donorName" = fr."donorName"
        ORDER BY fr.reached_at ASC
        LIMIT :limit
        `,
        {
            replacements: { pageKey, threshold, limit },
            type: QueryTypes.SELECT,
        }
    );

    return rows;
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
    SPECIAL_THEME_THRESHOLD_AMOUNT,
    SPECIAL_THEME_LEADERBOARD_LIMIT,
    findByPaymentTradeNo,
    createDonation,
    listRecentByPageId,
    listRecentByPageKey,
    listSpecialDonationsByPageKey,
    countByPageKey,
    sumAmountByPageId,
    isDuplicateWithinWindow,
};
