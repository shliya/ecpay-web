const { Op } = require('sequelize');
const sequelize = require('../config/database');
const LargeCrowdfundingPage = require('../model/schema/large-crowdfunding-page');
const { LCF_PAGE_STATUS } = require('../lib/large-crowdfunding');

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
    'periodLabel',
    'fundraisingStartsAt',
    'fundraisingEndsAt',
    'manuallyClosed',
    'publishedAt',
    'status',
    'currentTotal',
    'milestones',
    'updated_at',
];

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

async function upsertByMerchantIdAndPageKey(row, { transaction } = {}) {
    const existing = await findByMerchantIdAndPageKey(
        row.merchantId,
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

async function setPageStatus(merchantId, pageKey, status, { transaction } = {}) {
    const row = await findByMerchantIdAndPageKey(merchantId, pageKey);
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
    findByMerchantIdAndPageKey,
    findByPageKey,
    findPublishedByPageKey,
    findById,
    findByIdAndMerchantId,
    listSummariesByMerchantId,
    upsertByMerchantIdAndPageKey,
    setPageStatus,
    setPublishedAt,
    incrementCurrentTotal,
};
