const PageStore = require('../store/large-crowdfunding-page');
const DonationStore = require('../store/large-crowdfunding-donation');
const {
    isLargeCrowdfundingEnabledForMerchant,
} = require('../lib/large-crowdfunding-feature');
const {
    resolveEcpayConfigFromMerchantKey,
} = require('../lib/large-crowdfunding-config');
const {
    normalizePageKey,
    pageRowToApiJson,
    pageRowToPublicApiJson,
    pageRowToSummaryJson,
    apiJsonToPageRow,
    assertPageAcceptsDonationsAtOrderTime,
    parseLargeCrowdfundingPageId,
    parseEcpayConfigId,
    LCF_PAGE_STATUS,
    isPageActiveStatus,
} = require('../lib/large-crowdfunding');

async function listPageSummariesByMerchantId(merchantId) {
    const resolved = await resolveEcpayConfigFromMerchantKey(merchantId);
    if (!resolved) {
        return [];
    }
    const rows = await PageStore.listSummariesByEcpayConfigId(
        resolved.ecpayConfigId
    );
    return rows.map(row => pageRowToSummaryJson(row)).filter(Boolean);
}

async function getPageByMerchantIdAndPageKey(merchantId, pageKey) {
    const key = normalizePageKey(pageKey);
    if (!key) {
        return null;
    }
    const resolved = await resolveEcpayConfigFromMerchantKey(merchantId);
    if (!resolved) {
        return null;
    }
    const row = await PageStore.findByEcpayConfigIdAndPageKey(
        resolved.ecpayConfigId,
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
    let row = null;
    if (mid) {
        const resolved = await resolveEcpayConfigFromMerchantKey(mid);
        if (!resolved) {
            return { status: 'not_found' };
        }
        row = await PageStore.findByEcpayConfigIdAndPageKey(
            resolved.ecpayConfigId,
            key
        );
    } else {
        row = await PageStore.findByPageKey(key);
    }

    if (!row) {
        return { status: 'not_found' };
    }
    if (!isPageActiveStatus(row.status)) {
        return { status: 'not_found' };
    }
    if (!row.publishedAt) {
        return { status: 'not_published' };
    }

    const json = pageRowToPublicApiJson(row);
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
    const key = normalizePageKey(pageKey);
    const resolved = await resolveEcpayConfigFromMerchantKey(merchantId);
    if (!resolved || !key) {
        throw new Error('merchantId 或 pageKey 無效');
    }
    const existing = await PageStore.findByEcpayConfigIdAndPageKey(
        resolved.ecpayConfigId,
        key
    );
    if (existing && Number(existing.status) === LCF_PAGE_STATUS.DELETED) {
        const err = new Error('專案已刪除，無法再編輯');
        err.statusCode = 410;
        throw err;
    }
    const row = apiJsonToPageRow(
        body,
        resolved.ecpayConfigId,
        resolved.merchantId,
        key
    );
    const saved = await PageStore.upsertByEcpayConfigIdAndPageKey(row);
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
    const key = normalizePageKey(pageKey);
    const resolved = await resolveEcpayConfigFromMerchantKey(merchantId);
    if (!resolved || !key) {
        return { status: 'not_found' };
    }
    const existing = await PageStore.findByEcpayConfigIdAndPageKey(
        resolved.ecpayConfigId,
        key
    );
    if (!existing) {
        return { status: 'not_found' };
    }
    if (Number(existing.status) === LCF_PAGE_STATUS.DELETED) {
        return { status: 'already_deleted' };
    }
    const row = await PageStore.setPageStatus(
        resolved.ecpayConfigId,
        key,
        LCF_PAGE_STATUS.DELETED
    );
    return { status: 'ok', page: pageRowToApiJson(row) };
}

async function getPageForDonationValidation(pageId, ecpayConfigId) {
    const id = Number(pageId);
    const cfgId = parseEcpayConfigId(ecpayConfigId);
    if (!Number.isInteger(id) || id <= 0 || cfgId == null) {
        return null;
    }
    const row = await PageStore.findByIdAndEcpayConfigId(id, cfgId);
    return row ? pageRowToApiJson(row) : null;
}

/**
 * 建立斗內訂單前驗證大型募資頁是否可收款
 * @returns {Promise<{ pageId: number, pageKey: string, ecpayConfigId: number }|null>}
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
    const resolved = await resolveEcpayConfigFromMerchantKey(mid);
    if (!resolved) {
        const err = new Error('找不到商店設定');
        err.statusCode = 404;
        throw err;
    }
    const page = await getPageForDonationValidation(
        pageId,
        resolved.ecpayConfigId
    );
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
    return {
        pageId: page.id,
        pageKey: page.pageKey,
        ecpayConfigId: page.ecpayConfigId,
    };
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
