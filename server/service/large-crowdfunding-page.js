const PageStore = require('../store/large-crowdfunding-page');
const DonationStore = require('../store/large-crowdfunding-donation');
const {
    isLargeCrowdfundingEnabledForMerchant,
} = require('../lib/large-crowdfunding-feature');
const {
    normalizePageKey,
    pageRowToApiJson,
    pageRowToSummaryJson,
    apiJsonToPageRow,
    assertPageAcceptsDonationsAtOrderTime,
    parseLargeCrowdfundingPageId,
    LCF_PAGE_STATUS,
    isPageActiveStatus,
} = require('../lib/large-crowdfunding');

async function listPageSummariesByMerchantId(merchantId) {
    const mid = String(merchantId || '').trim();
    if (!mid) {
        return [];
    }
    const rows = await PageStore.listSummariesByMerchantId(mid);
    return rows
        .map(row => pageRowToSummaryJson(row))
        .filter(Boolean);
}

async function getPageByMerchantIdAndPageKey(merchantId, pageKey) {
    const key = normalizePageKey(pageKey);
    if (!key) {
        return null;
    }
    const row = await PageStore.findByMerchantIdAndPageKey(
        String(merchantId || '').trim(),
        key
    );
    if (!row) {
        return null;
    }
    if (Number(row.status) === LCF_PAGE_STATUS.DELETED) {
        return null;
    }
    return pageRowToApiJson(row);
}

/**
 * @param {string} pageKey
 * @param {string} [merchantId]
 * @returns {Promise<{ status: 'ok', data: object }|{ status: 'not_found'|'not_published'|'invalid_key' }>}
 */
async function getPublicPageByPageKey(pageKey, merchantId) {
    const key = normalizePageKey(pageKey);
    if (!key) {
        return { status: 'invalid_key' };
    }

    const mid = merchantId ? String(merchantId).trim() : '';
    const row = mid
        ? await PageStore.findByMerchantIdAndPageKey(mid, key)
        : await PageStore.findByPageKey(key);

    if (!row) {
        return { status: 'not_found' };
    }
    if (!isPageActiveStatus(row.status)) {
        return { status: 'not_found' };
    }
    if (!row.publishedAt) {
        return { status: 'not_published' };
    }

    const json = pageRowToApiJson(row);
    const sum = await DonationStore.sumAmountByPageId(row.id);
    json.currentTotal = sum;
    return { status: 'ok', data: json };
}

/** @deprecated 使用 getPublicPageByPageKey */
async function getPublishedPageByPageKey(pageKey) {
    const result = await getPublicPageByPageKey(pageKey);
    return result.status === 'ok' ? result.data : null;
}

async function upsertPage(merchantId, pageKey, body) {
    const mid = String(merchantId || '').trim();
    const key = normalizePageKey(pageKey);
    if (!mid || !key) {
        throw new Error('merchantId 或 pageKey 無效');
    }
    const existing = await PageStore.findByMerchantIdAndPageKey(mid, key);
    if (existing && Number(existing.status) === LCF_PAGE_STATUS.DELETED) {
        const err = new Error('專案已刪除，無法再編輯');
        err.statusCode = 410;
        throw err;
    }
    const row = apiJsonToPageRow(body, mid, key);
    const saved = await PageStore.upsertByMerchantIdAndPageKey(row);
    return pageRowToApiJson(saved);
}

async function publishPage(merchantId, pageKey, body) {
    const json = await upsertPage(merchantId, pageKey, body);
    await PageStore.setPublishedAt(json.id, new Date());
    const row = await PageStore.findById(json.id);
    return pageRowToApiJson(row);
}

/**
 * 軟刪除專案（status=3，列表不再顯示）
 * @returns {Promise<{ status: 'ok', page: object }|{ status: 'not_found'|'already_deleted' }>}
 */
async function deletePage(merchantId, pageKey) {
    const mid = String(merchantId || '').trim();
    const key = normalizePageKey(pageKey);
    if (!mid || !key) {
        return { status: 'not_found' };
    }
    const existing = await PageStore.findByMerchantIdAndPageKey(mid, key);
    if (!existing) {
        return { status: 'not_found' };
    }
    if (Number(existing.status) === LCF_PAGE_STATUS.DELETED) {
        return { status: 'already_deleted' };
    }
    const row = await PageStore.setPageStatus(
        mid,
        key,
        LCF_PAGE_STATUS.DELETED
    );
    return { status: 'ok', page: pageRowToApiJson(row) };
}

async function getPageForDonationValidation(pageId, merchantId) {
    const id = Number(pageId);
    if (!Number.isInteger(id) || id <= 0) {
        return null;
    }
    const row = await PageStore.findByIdAndMerchantId(
        id,
        String(merchantId || '').trim()
    );
    return row ? pageRowToApiJson(row) : null;
}

/**
 * 建立斗內訂單前驗證大型募資頁是否可收款
 * @returns {Promise<{ pageId: number, pageKey: string }|null>}
 */
async function resolveDonateContext(merchantId, largeCrowdfundingPageId) {
    const pageId = parseLargeCrowdfundingPageId(largeCrowdfundingPageId);
    if (pageId == null) {
        return null;
    }
    const mid = String(merchantId || '').trim();
    if (!(await isLargeCrowdfundingEnabledForMerchant(mid))) {
        const err = new Error('此商店未開放大型募資功能');
        err.statusCode = 403;
        throw err;
    }
    const page = await getPageForDonationValidation(pageId, mid);
    const gate = assertPageAcceptsDonationsAtOrderTime(page);
    if (!gate.ok) {
        const err = new Error(gate.reason || '無法接受斗內');
        err.statusCode = 403;
        throw err;
    }
    if (!page) {
        const err = new Error('找不到大型募資活動');
        err.statusCode = 404;
        throw err;
    }
    return { pageId: page.id, pageKey: page.pageKey };
}

module.exports = {
    listPageSummariesByMerchantId,
    getPageByMerchantIdAndPageKey,
    getPublicPageByPageKey,
    getPublishedPageByPageKey,
    upsertPage,
    publishPage,
    deletePage,
    getPageForDonationValidation,
    resolveDonateContext,
};
