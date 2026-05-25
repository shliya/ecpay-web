const PAGE_KEY_RE = /^[a-z0-9_-]{1,80}$/i;

/** @enum {number} */
const LCF_PAGE_STATUS = {
    ACTIVE: 1,
    ENDED: 2,
    DELETED: 3,
};

/**
 * @param {string} raw
 * @returns {string|null}
 */
function normalizePageKey(raw) {
    const trimmed = String(raw || '').trim();
    if (!trimmed || !PAGE_KEY_RE.test(trimmed)) {
        return null;
    }
    return trimmed.toLowerCase();
}

/**
 * @param {object} row Sequelize instance or plain
 * @returns {object}
 */
function pageRowToApiJson(row) {
    if (!row) {
        return null;
    }
    const d = typeof row.get === 'function' ? row.get({ plain: true }) : row;
    return {
        id: d.id,
        pageKey: d.pageKey,
        merchantId: d.merchantId,
        largeFundraisingName: d.largeFundraisingName || '',
        title: d.title || '',
        sponsorLabel: d.sponsorLabel || '',
        periodLabel: d.periodLabel || '',
        fundraisingStartsAt: d.fundraisingStartsAt || null,
        fundraisingEndsAt: d.fundraisingEndsAt || null,
        manuallyClosed: !!d.manuallyClosed,
        backgroundImageUrl: d.backgroundImageUrl || '',
        heroImageUrl: d.heroImageUrl || '',
        logoImageUrl: d.logoImageUrl || '',
        donorListBackgroundImageUrl: d.donorListBackgroundImageUrl || '',
        donorTierIcons: d.donorTierIcons || {},
        theme: d.theme || {},
        contentBlocks: Array.isArray(d.contentBlocks) ? d.contentBlocks : [],
        milestones: Array.isArray(d.milestones) ? d.milestones : [],
        currentTotal: Number(d.currentTotal) || 0,
        publishedAt: d.publishedAt || null,
        status: normalizePageStatus(d.status),
    };
}

/**
 * @param {*} raw
 * @returns {number}
 */
function normalizePageStatus(raw) {
    const n = Number(raw);
    if (n === LCF_PAGE_STATUS.ENDED) {
        return LCF_PAGE_STATUS.ENDED;
    }
    if (n === LCF_PAGE_STATUS.DELETED) {
        return LCF_PAGE_STATUS.DELETED;
    }
    return LCF_PAGE_STATUS.ACTIVE;
}

function isPageActiveStatus(status) {
    return normalizePageStatus(status) === LCF_PAGE_STATUS.ACTIVE;
}

/**
 * @param {object} body
 * @param {string} merchantId
 * @param {string} pageKey
 * @returns {object}
 */
function apiJsonToPageRow(body, merchantId, pageKey) {
    const b = body && typeof body === 'object' ? body : {};
    return {
        merchantId,
        pageKey,
        largeFundraisingName: String(
            b.largeFundraisingName ?? b.title ?? ''
        ).slice(0, 200),
        title: String(b.title ?? '').slice(0, 200),
        sponsorLabel: String(b.sponsorLabel ?? ''),
        periodLabel: String(b.periodLabel ?? '').slice(0, 500),
        fundraisingStartsAt: b.fundraisingStartsAt || null,
        fundraisingEndsAt: b.fundraisingEndsAt || null,
        manuallyClosed: !!b.manuallyClosed,
        backgroundImageUrl: String(b.backgroundImageUrl ?? ''),
        heroImageUrl: String(b.heroImageUrl ?? ''),
        logoImageUrl: String(b.logoImageUrl ?? ''),
        donorListBackgroundImageUrl: String(
            b.donorListBackgroundImageUrl ?? ''
        ),
        donorTierIcons:
            b.donorTierIcons && typeof b.donorTierIcons === 'object'
                ? b.donorTierIcons
                : {},
        theme: b.theme && typeof b.theme === 'object' ? b.theme : {},
        contentBlocks: Array.isArray(b.contentBlocks) ? b.contentBlocks : [],
        milestones: Array.isArray(b.milestones) ? b.milestones : [],
    };
}

/**
 * 建單當下：須已發布、進行中、在募資期間內
 * @param {object} page plain page row
 * @returns {{ ok: boolean, reason?: string }}
 */
function assertPageAcceptsDonationsAtOrderTime(page) {
    if (!page) {
        return { ok: false, reason: '找不到大型募資活動' };
    }
    if (!page.publishedAt) {
        return { ok: false, reason: '募資頁尚未發布' };
    }
    if (!isPageActiveStatus(page.status)) {
        return { ok: false, reason: '募資活動已結束或已刪除' };
    }
    if (page.manuallyClosed) {
        return { ok: false, reason: '募資活動已結束' };
    }
    const now = Date.now();
    const start = page.fundraisingStartsAt
        ? new Date(page.fundraisingStartsAt).getTime()
        : NaN;
    const end = page.fundraisingEndsAt
        ? new Date(page.fundraisingEndsAt).getTime()
        : NaN;
    if (Number.isFinite(start) && now < start) {
        return { ok: false, reason: '募資活動尚未開始' };
    }
    if (Number.isFinite(end) && now > end) {
        return { ok: false, reason: '募資活動已結束' };
    }
    return { ok: true };
}

/**
 * 付款回調（有 DB 建單紀錄）：僅確認頁面存在、商家一致、未軟刪除
 * @param {object} page
 * @param {string} merchantId
 * @returns {{ ok: boolean, reason?: string }}
 */
function assertPageAcceptsPaymentCallback(page, merchantId) {
    if (!page) {
        return { ok: false, reason: '找不到大型募資活動' };
    }
    const mid = String(merchantId || '').trim();
    if (mid && String(page.merchantId || '').trim() !== mid) {
        return { ok: false, reason: '商家與募資頁不符' };
    }
    if (normalizePageStatus(page.status) === LCF_PAGE_STATUS.DELETED) {
        return { ok: false, reason: '募資活動已刪除' };
    }
    return { ok: true };
}

/** @deprecated 請用 assertPageAcceptsDonationsAtOrderTime */
function assertPageAcceptsDonations(page) {
    return assertPageAcceptsDonationsAtOrderTime(page);
}

/**
 * @param {string|number} raw
 * @returns {number|null}
 */
/**
 * @param {Array<{ thresholdAmount?: number }>} milestones
 * @param {number} currentTotal
 * @returns {number|null}
 */
function computeProgressPercent(milestones, currentTotal) {
    if (!Array.isArray(milestones) || milestones.length === 0) {
        return null;
    }
    const thresholds = milestones
        .map(m => Number(m && m.thresholdAmount))
        .filter(n => Number.isFinite(n) && n > 0);
    if (thresholds.length === 0) {
        return null;
    }
    const max = Math.max(...thresholds);
    const total = Number(currentTotal) || 0;
    return Math.min(100, Math.round((total / max) * 100));
}

function pageRowToSummaryJson(row) {
    if (!row) {
        return null;
    }
    const d = typeof row.get === 'function' ? row.get({ plain: true }) : row;
    const status = getCrowdfundingActivityStatusFromPlain(d);
    const progressPercent = computeProgressPercent(
        d.milestones,
        d.currentTotal
    );
    return {
        id: d.id,
        pageKey: d.pageKey,
        largeFundraisingName: d.largeFundraisingName || '',
        title: d.title || '',
        periodLabel: d.periodLabel || '',
        fundraisingStartsAt: d.fundraisingStartsAt || null,
        fundraisingEndsAt: d.fundraisingEndsAt || null,
        manuallyClosed: !!d.manuallyClosed,
        publishedAt: d.publishedAt || null,
        currentTotal: Number(d.currentTotal) || 0,
        activityStatus: status,
        progressPercent,
        isPublished: !!d.publishedAt,
    };
}

function getCrowdfundingActivityStatusFromPlain(data) {
    if (data && data.manuallyClosed) {
        return {
            key: 'manually_closed',
            label: '已手動關閉',
        };
    }
    const now = Date.now();
    const start = data.fundraisingStartsAt
        ? new Date(data.fundraisingStartsAt).getTime()
        : NaN;
    const end = data.fundraisingEndsAt
        ? new Date(data.fundraisingEndsAt).getTime()
        : NaN;
    if (Number.isFinite(start) && now < start) {
        return { key: 'not_started', label: '尚未開始' };
    }
    if (Number.isFinite(end) && now > end) {
        return { key: 'ended', label: '已結束' };
    }
    return { key: 'active', label: '進行中' };
}

function parseLargeCrowdfundingPageId(raw) {
    if (raw == null || raw === '') {
        return null;
    }
    const n = Number(raw);
    if (!Number.isInteger(n) || n <= 0) {
        return null;
    }
    return n;
}

module.exports = {
    PAGE_KEY_RE,
    LCF_PAGE_STATUS,
    normalizePageKey,
    normalizePageStatus,
    isPageActiveStatus,
    pageRowToApiJson,
    pageRowToSummaryJson,
    apiJsonToPageRow,
    assertPageAcceptsDonations,
    assertPageAcceptsDonationsAtOrderTime,
    assertPageAcceptsPaymentCallback,
    computeProgressPercent,
    parseLargeCrowdfundingPageId,
};
