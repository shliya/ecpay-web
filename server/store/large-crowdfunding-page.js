const { Op } = require('sequelize');
const sequelize = require('../config/database');
const LargeCrowdfundingPage = require('../model/schema/large-crowdfunding-page');
const { LCF_PAGE_STATUS, parseEcpayConfigId } = require('../lib/large-crowdfunding');

async function findByEcpayConfigIdAndPageKey(ecpayConfigId, pageKey) {
    const cfgId = parseEcpayConfigId(ecpayConfigId);
    if (cfgId == null) {
        return null;
    }
    return LargeCrowdfundingPage.findOne({
        where: { ecpayConfigId: cfgId, pageKey },
    });
}

/** @deprecated 請用 findByEcpayConfigIdAndPageKey；保留給尚未遷移的呼叫 */
async function findByMerchantIdAndPageKey(merchantId, pageKey) {
    return LargeCrowdfundingPage.findOne({
        where: { merchantId, pageKey },
    });
}

async function findByPageKey(pageKey) {
    return LargeCrowdfundingPage.findOne({
        where: { pageKey },
    });
}

async function findPublishedByPageKey(pageKey) {
    return LargeCrowdfundingPage.findOne({
        where: {
            pageKey,
            publishedAt: { [Op.ne]: null },
            status: LCF_PAGE_STATUS.ACTIVE,
        },
    });
}

async function findById(id) {
    return LargeCrowdfundingPage.findByPk(id);
}

async function findByIdAndEcpayConfigId(id, ecpayConfigId) {
    const pageId = Number(id);
    const cfgId = parseEcpayConfigId(ecpayConfigId);
    if (!Number.isInteger(pageId) || pageId <= 0 || cfgId == null) {
        return null;
    }
    return LargeCrowdfundingPage.findOne({
        where: { id: pageId, ecpayConfigId: cfgId },
    });
}

/** @deprecated */
async function findByIdAndMerchantId(id, merchantId) {
    return LargeCrowdfundingPage.findOne({
        where: { id, merchantId },
    });
}

const LIST_SUMMARY_ATTRIBUTES = [
    'id',
    'pageKey',
    'largeFundraisingName',
    'title',
    'fundraisingStartsAt',
    'fundraisingEndsAt',
    'manuallyClosed',
    'publishedAt',
    'status',
    'currentTotal',
    'milestones',
    'updated_at',
];

async function listSummariesByEcpayConfigId(ecpayConfigId) {
    const cfgId = parseEcpayConfigId(ecpayConfigId);
    if (cfgId == null) {
        return [];
    }
    return LargeCrowdfundingPage.findAll({
        where: {
            ecpayConfigId: cfgId,
            status: { [Op.ne]: LCF_PAGE_STATUS.DELETED },
        },
        attributes: LIST_SUMMARY_ATTRIBUTES,
        order: [['updated_at', 'DESC']],
    });
}

/** @deprecated */
async function listSummariesByMerchantId(merchantId) {
    return LargeCrowdfundingPage.findAll({
        where: {
            merchantId: String(merchantId || '').trim(),
            status: { [Op.ne]: LCF_PAGE_STATUS.DELETED },
        },
        attributes: LIST_SUMMARY_ATTRIBUTES,
        order: [['updated_at', 'DESC']],
    });
}

async function upsertByEcpayConfigIdAndPageKey(row, { transaction } = {}) {
    const existing = await findByEcpayConfigIdAndPageKey(
        row.ecpayConfigId,
        row.pageKey
    );
    const now = new Date();
    if (existing) {
        const { status: _omitStatus, ...rowWithoutStatus } = row;
        await existing.update(
            {
                ...rowWithoutStatus,
                updated_at: now,
            },
            { transaction }
        );
        return existing.reload({ transaction });
    }
    return LargeCrowdfundingPage.create(
        {
            ...row,
            status: LCF_PAGE_STATUS.ACTIVE,
            currentTotal: 0,
            created_at: now,
            updated_at: now,
        },
        { transaction }
    );
}

/** @deprecated */
async function upsertByMerchantIdAndPageKey(row, { transaction } = {}) {
    return upsertByEcpayConfigIdAndPageKey(row, { transaction });
}

async function setPageStatus(ecpayConfigId, pageKey, status, { transaction } = {}) {
    const row = await findByEcpayConfigIdAndPageKey(ecpayConfigId, pageKey);
    if (!row) {
        return null;
    }
    await row.update(
        { status, updated_at: new Date() },
        { transaction }
    );
    return row.reload({ transaction });
}

async function setPublishedAt(id, publishedAt, { transaction } = {}) {
    const [count] = await LargeCrowdfundingPage.update(
        { publishedAt, updated_at: new Date() },
        { where: { id }, transaction }
    );
    return count;
}

async function incrementCurrentTotal(id, delta, { transaction } = {}) {
    await LargeCrowdfundingPage.increment('currentTotal', {
        by: delta,
        where: { id },
        transaction,
    });
}

function getTransaction() {
    return sequelize.transaction();
}

module.exports = {
    getTransaction,
    findByEcpayConfigIdAndPageKey,
    findByMerchantIdAndPageKey,
    findByPageKey,
    findPublishedByPageKey,
    findById,
    findByIdAndEcpayConfigId,
    findByIdAndMerchantId,
    listSummariesByEcpayConfigId,
    listSummariesByMerchantId,
    upsertByEcpayConfigIdAndPageKey,
    upsertByMerchantIdAndPageKey,
    setPageStatus,
    setPublishedAt,
    incrementCurrentTotal,
};
