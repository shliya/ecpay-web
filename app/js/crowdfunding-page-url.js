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
