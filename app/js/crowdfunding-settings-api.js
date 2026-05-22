/**
 * 大型募資設定 API（Phase 1：靜態 JSON + localStorage 草稿；Phase 2 串接後端）
 */

const CF_DATA_BASE = '/crowdfunding-data';
const CF_DRAFT_PREFIX = 'ecpay-cf-draft:';
const CF_PREVIEW_PREFIX = 'ecpay-cf-preview:';

/** @returns {string} */
export function draftStorageKey(merchantId, pageKey) {
    return CF_DRAFT_PREFIX + String(merchantId || '') + ':' + pageKey;
}

/** @returns {string} */
export function previewStorageKey(pageKey) {
    return CF_PREVIEW_PREFIX + pageKey;
}

/**
 * @param {object} raw
 * @returns {object}
 */
export function stripCrowdfundingMeta(raw) {
    if (!raw || typeof raw !== 'object') {
        return {};
    }
    const out = { ...raw };
    delete out._說明;
    return out;
}

/** 頁面設定 JSON 不儲存榜單（榜單由資料庫即時提供） */
export function prepareCrowdfundingPageConfig(data) {
    const out = stripCrowdfundingMeta(data);
    delete out.recentDonors;
    return out;
}

/**
 * TODO Phase 2: GET /api/v1/comme/ecpay/crowdfunding/donors/pageKey=:pageKey
 * 由資料庫讀取近期斗內榜單（依金額排序）。
 * @param {string} pageKey
 * @returns {Promise<Array<{ name: string, amount: number }>>}
 */
export async function fetchRecentDonors(pageKey) {
    const key = String(pageKey || 'default').trim() || 'default';
    const url =
        '/api/v1/comme/ecpay/crowdfunding/donors/pageKey=' +
        encodeURIComponent(key);
    try {
        const res = await fetch(url, { cache: 'no-store' });
        if (!res.ok) {
            return [];
        }
        const body = await res.json();
        if (Array.isArray(body)) {
            return body;
        }
        if (Array.isArray(body.recentDonors)) {
            return body.recentDonors;
        }
        if (Array.isArray(body.donors)) {
            return body.donors;
        }
        return [];
    } catch {
        return [];
    }
}

/**
 * API 優先；無資料時使用 JSON 內 recentDonors（如 default.json 測試資料）。
 * @param {string} pageKey
 * @param {object} [pageData]
 * @returns {Promise<Array<{ name: string, amount: number }>>}
 */
export async function resolveRecentDonors(pageKey, pageData) {
    const fromApi = await fetchRecentDonors(pageKey);
    if (fromApi.length > 0) {
        return fromApi;
    }
    if (
        pageData &&
        Array.isArray(pageData.recentDonors) &&
        pageData.recentDonors.length > 0
    ) {
        return pageData.recentDonors;
    }
    try {
        const fixture = await fetchCrowdfundingStatic(pageKey);
        if (
            Array.isArray(fixture.recentDonors) &&
            fixture.recentDonors.length > 0
        ) {
            return fixture.recentDonors;
        }
    } catch {
        /* static 測試檔不存在 */
    }
    return [];
}

/**
 * TODO Phase 2: GET /api/v1/comme/ecpay/crowdfunding/id=:merchantId/pageKey=:pageKey
 * @param {string} merchantId
 * @param {string} pageKey
 * @returns {Promise<object|null>}
 */
export async function fetchCrowdfundingFromApi(merchantId, pageKey) {
    const url =
        '/api/v1/comme/ecpay/crowdfunding/id=' +
        encodeURIComponent(merchantId) +
        '/pageKey=' +
        encodeURIComponent(pageKey);
    try {
        const res = await fetch(url, { cache: 'no-store' });
        if (!res.ok) {
            return null;
        }
        const data = await res.json();
        return stripCrowdfundingMeta(data);
    } catch {
        return null;
    }
}

/**
 * @param {string} pageKey
 * @returns {Promise<object>}
 */
export async function fetchCrowdfundingStatic(pageKey) {
    const res = await fetch(
        `${CF_DATA_BASE}/${encodeURIComponent(pageKey)}.json`,
        { cache: 'no-store' }
    );
    if (!res.ok) {
        throw new Error('static_load_failed');
    }
    return stripCrowdfundingMeta(await res.json());
}

/**
 * @param {string} merchantId
 * @param {string} pageKey
 * @returns {object|null}
 */
export function loadCrowdfundingDraft(merchantId, pageKey) {
    try {
        const raw = localStorage.getItem(draftStorageKey(merchantId, pageKey));
        if (!raw) {
            return null;
        }
        return stripCrowdfundingMeta(JSON.parse(raw));
    } catch {
        return null;
    }
}

/**
 * @param {string} merchantId
 * @param {string} pageKey
 * @param {object} data
 */
export function saveCrowdfundingDraft(merchantId, pageKey, data) {
    localStorage.setItem(
        draftStorageKey(merchantId, pageKey),
        JSON.stringify(prepareCrowdfundingPageConfig(data), null, 2)
    );
}

/**
 * @param {string} merchantId
 * @param {string} pageKey
 */
export function clearCrowdfundingDraft(merchantId, pageKey) {
    localStorage.removeItem(draftStorageKey(merchantId, pageKey));
}

/**
 * TODO Phase 2: PUT /api/v1/comme/ecpay/crowdfunding/id=:merchantId/pageKey=:pageKey
 * @param {string} merchantId
 * @param {string} pageKey
 * @param {object} data
 * @returns {Promise<{ ok: boolean, source: string }>}
 */
export async function saveCrowdfundingPage(merchantId, pageKey, data) {
    const payload = prepareCrowdfundingPageConfig(data);
    saveCrowdfundingDraft(merchantId, pageKey, payload);
    try {
        const url =
            '/api/v1/comme/ecpay/crowdfunding/id=' +
            encodeURIComponent(merchantId) +
            '/pageKey=' +
            encodeURIComponent(pageKey);
        const res = await fetch(url, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });
        if (res.ok) {
            return { ok: true, source: 'api' };
        }
    } catch {
        /* API 尚未上線 */
    }
    return { ok: true, source: 'localDraft' };
}

/**
 * TODO Phase 2: POST .../crowdfunding/.../publish
 * @param {string} merchantId
 * @param {string} pageKey
 * @param {object} data
 * @returns {Promise<{ ok: boolean, source: string }>}
 */
export async function publishCrowdfundingPage(merchantId, pageKey, data) {
    const payload = prepareCrowdfundingPageConfig(data);
    await saveCrowdfundingPage(merchantId, pageKey, payload);
    try {
        const url =
            '/api/v1/comme/ecpay/crowdfunding/id=' +
            encodeURIComponent(merchantId) +
            '/pageKey=' +
            encodeURIComponent(pageKey) +
            '/publish';
        const res = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload),
        });
        if (res.ok) {
            return { ok: true, source: 'api' };
        }
    } catch {
        /* API 尚未上線 */
    }
    return { ok: true, source: 'exportOnly' };
}

/**
 * @param {string} merchantId
 * @param {string} pageKey
 * @param {{ preferDraft?: boolean }} [opts]
 * @returns {Promise<{ data: object, source: string }>}
 */
export async function loadCrowdfundingPage(merchantId, pageKey, opts) {
    const preferDraft = opts && opts.preferDraft;

    if (preferDraft) {
        const draft = loadCrowdfundingDraft(merchantId, pageKey);
        if (draft) {
            return {
                data: prepareCrowdfundingPageConfig(draft),
                source: 'localDraft',
            };
        }
    }

    const fromApi = await fetchCrowdfundingFromApi(merchantId, pageKey);
    if (fromApi) {
        return {
            data: prepareCrowdfundingPageConfig(fromApi),
            source: 'api',
        };
    }

    const draft = loadCrowdfundingDraft(merchantId, pageKey);
    if (draft) {
        return {
            data: prepareCrowdfundingPageConfig(draft),
            source: 'localDraft',
        };
    }

    const staticData = await fetchCrowdfundingStatic(pageKey);
    return {
        data: prepareCrowdfundingPageConfig(staticData),
        source: 'static',
    };
}

/**
 * @param {object} data
 * @returns {{ key: string, label: string, detail: string }}
 */
export function getCrowdfundingActivityStatus(data) {
    if (data && data.manuallyClosed) {
        return {
            key: 'manually_closed',
            label: '已手動關閉',
            detail: '管理員已關閉活動，正式前台將顯示終止畫面。',
        };
    }

    const now = Date.now();
    const startRaw = data && data.fundraisingStartsAt;
    const endRaw = data && data.fundraisingEndsAt;
    const start = startRaw ? new Date(startRaw).getTime() : NaN;
    const end = endRaw ? new Date(endRaw).getTime() : NaN;

    if (Number.isFinite(start) && now < start) {
        return {
            key: 'not_started',
            label: '尚未開始',
            detail: '未到募資開始時間。',
        };
    }

    if (Number.isFinite(end) && now > end) {
        return {
            key: 'ended',
            label: '已結束',
            detail: '已超過募資結束時間。',
        };
    }

    return {
        key: 'active',
        label: '進行中',
        detail: '活動開放中（依開始／結束時間判斷）。',
    };
}

/**
 * @param {string} pageKey
 * @param {object} data
 */
export function stashCrowdfundingPreview(pageKey, data) {
    sessionStorage.setItem(
        previewStorageKey(pageKey),
        JSON.stringify(prepareCrowdfundingPageConfig(data))
    );
}

/**
 * @param {string} pageKey
 * @returns {object|null}
 */
export function readCrowdfundingPreview(pageKey) {
    try {
        const raw = sessionStorage.getItem(previewStorageKey(pageKey));
        if (!raw) {
            return null;
        }
        return stripCrowdfundingMeta(JSON.parse(raw));
    } catch {
        return null;
    }
}
