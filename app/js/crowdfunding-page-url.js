const PAGE_KEY_RE = /^[a-z0-9_-]{1,80}$/i;

export function normalizePageKey(raw) {
    const trimmed = String(raw || '').trim();
    if (!trimmed || !PAGE_KEY_RE.test(trimmed)) {
        return null;
    }
    return trimmed.toLowerCase();
}

export function getCrowdfundingQueryParams() {
    const params = new URLSearchParams(window.location.search);
    return {
        pageKey: normalizePageKey(params.get('name') || ''),
        merchantId: String(params.get('merchantId') || '').trim(),
        preview: params.get('preview') === '1',
    };
}

export function getCrowdfundingDonorsQueryParams() {
    const base = getCrowdfundingQueryParams();
    const params = new URLSearchParams(window.location.search);
    let donorPage = Number(params.get('page'));
    if (!Number.isFinite(donorPage) || donorPage < 1) {
        donorPage = 1;
    }
    return {
        ...base,
        donorPage: Math.floor(donorPage),
    };
}

/**
 * @param {string} pageKey
 * @param {{ merchantId?: string, preview?: boolean }} [opts]
 */
export function buildCrowdfundingDonorsAllUrl(pageKey, opts) {
    const key = normalizePageKey(pageKey) || 'default';
    const options = opts || {};
    const path = window.location.pathname.replace(/[^/]*$/, '');
    const params = new URLSearchParams({ name: key });
    if (options.merchantId) {
        params.set('merchantId', options.merchantId);
    }
    if (options.preview) {
        params.set('preview', '1');
    }
    if (options.donorPage != null && Number(options.donorPage) > 1) {
        params.set('page', String(Math.floor(Number(options.donorPage))));
    }
    return (
        window.location.origin +
        path +
        'crowdfunding-donors.html?' +
        params.toString()
    );
}

/**
 * 大型募資專用斗內連結（可外掛到其他網站）
 * @param {{ merchantId?: string|null, pageId?: number|string|null }} opts
 * @returns {string|null}
 */
export function buildLargeCrowdfundingDonateUrl(opts) {
    const options = opts || {};
    const merchantId =
        options.merchantId != null ? String(options.merchantId).trim() : '';
    const pageId = Number(options.pageId);
    if (!merchantId || !Number.isInteger(pageId) || pageId <= 0) {
        return null;
    }
    const path = window.location.pathname.replace(/[^/]*$/, '');
    const params = new URLSearchParams({
        merchantId,
        largeCrowdfundingPageId: String(pageId),
    });
    return (
        window.location.origin +
        path +
        'viewer-donate.html?' +
        params.toString()
    );
}

/** 大型募資斗內頁警語（先寫死；之後可改後台設定） */
export const LCF_DONATE_WARNING_TEXT =
    '請在暱稱寫上票券號碼，不然視為沒搶到票';
