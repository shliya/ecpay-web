/**
 * 大型募資設定 API（伺服器 API + localStorage 草稿／預覽）
 */

import { getTotpToken } from './totp-guard.js';

const CF_DRAFT_PREFIX = 'ecpay-cf-draft:';

function buildAuthHeaders(merchantId, extra = {}) {
    const headers = { ...extra };
    const token = getTotpToken(merchantId);
    if (token) {
        headers['X-TOTP-Token'] = token;
    }
    return headers;
}
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

function parseDonorsFromBody(body) {
    if (Array.isArray(body)) {
        return body;
    }
    if (body && Array.isArray(body.recentDonors)) {
        return body.recentDonors;
    }
    if (body && Array.isArray(body.donors)) {
        return body.donors;
    }
    return [];
}

/**
 * GET /api/v1/comme/crowdfunding/donors/pageKey=:pageKey?page=&limit=
 * @returns {Promise<{ donors: Array, page: number, limit: number, totalCount: number, totalPages: number }>}
 */
export async function fetchDonorsPaged(pageKey, opts) {
    const key = String(pageKey || 'default').trim() || 'default';
    const options = opts || {};
    const params = new URLSearchParams();
    const page = Math.max(1, Math.floor(Number(options.page)) || 1);
    const limit = Math.max(1, Math.floor(Number(options.limit)) || 20);
    params.set('page', String(page));
    params.set('limit', String(limit));

    const url =
        '/api/v1/comme/crowdfunding/donors/pageKey=' +
        encodeURIComponent(key) +
        '?' +
        params.toString();

    const empty = {
        donors: [],
        page,
        limit,
        totalCount: 0,
        totalPages: 0,
    };

    try {
        const res = await fetch(url, { cache: 'no-store' });
        if (!res.ok) {
            return empty;
        }
        const body = await res.json();
        const donors = parseDonorsFromBody(body);
        return {
            donors,
            page: Number(body.page) > 0 ? Number(body.page) : page,
            limit: Number(body.limit) > 0 ? Number(body.limit) : limit,
            totalCount: Math.max(0, Number(body.totalCount) || 0),
            totalPages: Math.max(0, Number(body.totalPages) || 0),
        };
    } catch {
        return empty;
    }
}

/** 主頁榜單顯示筆數 */
export const CROWDFUNDING_MAIN_DONOR_LIMIT = 10;

/** 全部斗內頁每頁筆數 */
export const CROWDFUNDING_ALL_DONORS_PAGE_SIZE = 10;

/**
 * GET /api/v1/comme/crowdfunding/donors/pageKey=:pageKey/ten
 * 榜十大哥固定前 10 名。
 */
export async function fetchDonorsTen(pageKey) {
    const key = String(pageKey || 'default').trim() || 'default';
    const url =
        '/api/v1/comme/crowdfunding/donors/pageKey=' +
        encodeURIComponent(key) +
        '/ten';

    const empty = {
        donors: [],
        page: 1,
        limit: CROWDFUNDING_MAIN_DONOR_LIMIT,
        totalCount: 0,
        totalPages: 0,
    };

    try {
        const res = await fetch(url, { cache: 'no-store' });
        if (!res.ok) {
            return empty;
        }
        const body = await res.json();
        const donors = parseDonorsFromBody(body);
        return {
            donors,
            page: Number(body.page) > 0 ? Number(body.page) : 1,
            limit:
                Number(body.limit) > 0 ?
                    Number(body.limit)
                :   CROWDFUNDING_MAIN_DONOR_LIMIT,
            totalCount: Math.max(0, Number(body.totalCount) || 0),
            totalPages: Math.max(0, Number(body.totalPages) || 0),
        };
    } catch {
        return empty;
    }
}

/**
 * @param {string} pageKey
 * @returns {Promise<Array<{ name: string, amount: number }>>}
 */
export async function fetchRecentDonors(pageKey) {
    const result = await fetchDonorsTen(pageKey);
    return result.donors;
}

export async function resolveRecentDonors(pageKey) {
    return fetchRecentDonors(pageKey);
}

/**
 * 是否開放大型募資（讀 public config）
 * @param {string} merchantId
 * @returns {Promise<boolean>}
 */
export async function fetchLargeCrowdfundingEnabled(merchantId) {
    try {
        const res = await fetch(
            '/api/v1/comme/ecpay/config/public/id=' +
                encodeURIComponent(merchantId)
        );
        if (!res.ok) {
            return false;
        }
        const data = await res.json();
        return data.largeCrowdfundingEnabled === true;
    } catch {
        return false;
    }
}

/**
 * GET /api/v1/comme/crowdfunding/id=:merchantId（列表摘要）
 * @param {string} merchantId
 * @returns {Promise<Array<object>>}
 */
export async function fetchCrowdfundingList(merchantId) {
    const url =
        '/api/v1/comme/crowdfunding/id=' + encodeURIComponent(merchantId);
    try {
        const res = await fetch(url, { cache: 'no-store' });
        if (!res.ok) {
            return [];
        }
        const body = await res.json();
        if (Array.isArray(body)) {
            return body;
        }
        if (Array.isArray(body.pages)) {
            return body.pages;
        }
        return [];
    } catch {
        return [];
    }
}

/**
 * GET /api/v1/comme/crowdfunding/id=:merchantId/pageKey=:pageKey
 * @param {string} merchantId
 * @param {string} pageKey
 * @returns {Promise<object|null>}
 */
export async function fetchCrowdfundingFromApi(merchantId, pageKey) {
    const url =
        '/api/v1/comme/crowdfunding/id=' +
        encodeURIComponent(merchantId) +
        '/pageKey=' +
        encodeURIComponent(pageKey);
    try {
        const res = await fetch(url, {
            cache: 'no-store',
            headers: buildAuthHeaders(merchantId),
        });
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
 * GET /api/v1/comme/crowdfunding/pageKey=:pageKey（已發布）
 * 或 /crowdfunding/public/id=:merchantId/pageKey=:pageKey
 * @param {string} pageKey
 * @param {string} [merchantId]
 * @returns {Promise<object|null>}
 */
export async function fetchCrowdfundingPublic(pageKey, merchantId) {
    const key = String(pageKey || '').trim();
    const mid = merchantId ? String(merchantId).trim() : '';
    const url = mid
        ? '/api/v1/comme/crowdfunding/public/id=' +
          encodeURIComponent(mid) +
          '/pageKey=' +
          encodeURIComponent(key)
        : '/api/v1/comme/crowdfunding/pageKey=' + encodeURIComponent(key);
    try {
        const res = await fetch(url, { cache: 'no-store' });
        if (res.status === 403) {
            const body = await res.json().catch(() => ({}));
            if (body.code === 'not_published') {
                const err = new Error('not_published');
                throw err;
            }
        }
        if (!res.ok) {
            return null;
        }
        return stripCrowdfundingMeta(await res.json());
    } catch (err) {
        if (err && err.message === 'not_published') {
            throw err;
        }
        return null;
    }
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
 * PUT /api/v1/comme/crowdfunding/id=:merchantId/pageKey=:pageKey
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
            '/api/v1/comme/crowdfunding/id=' +
            encodeURIComponent(merchantId) +
            '/pageKey=' +
            encodeURIComponent(pageKey);
        const res = await fetch(url, {
            method: 'PUT',
            headers: buildAuthHeaders(merchantId, {
                'Content-Type': 'application/json',
            }),
            body: JSON.stringify(payload),
        });
        if (res.ok) {
            return { ok: true, source: 'api' };
        }
        if (res.status === 401) {
            const body = await res.json().catch(() => ({}));
            return {
                ok: false,
                source: 'auth',
                error: body.error || '需要 TOTP 驗證碼',
            };
        }
    } catch {
        /* 網路錯誤 */
    }
    return { ok: true, source: 'localDraft' };
}

/**
 * POST .../crowdfunding/.../publish
 * @param {string} merchantId
 * @param {string} pageKey
 * @param {object} data
 * @returns {Promise<{ ok: boolean, source: string }>}
 */
/**
 * DELETE /api/v1/comme/crowdfunding/id=:merchantId/pageKey=:pageKey
 * 軟刪除（status=3）
 * @param {string} merchantId
 * @param {string} pageKey
 * @returns {Promise<{ ok: boolean, source?: string, error?: string }>}
 */
export async function deleteCrowdfundingPage(merchantId, pageKey) {
    try {
        const url =
            '/api/v1/comme/crowdfunding/id=' +
            encodeURIComponent(merchantId) +
            '/pageKey=' +
            encodeURIComponent(pageKey);
        const res = await fetch(url, {
            method: 'DELETE',
            headers: buildAuthHeaders(merchantId),
        });
        if (res.ok) {
            clearCrowdfundingDraft(merchantId, pageKey);
            return { ok: true, source: 'api' };
        }
        if (res.status === 401) {
            const body = await res.json().catch(() => ({}));
            return {
                ok: false,
                source: 'auth',
                error: body.error || '需要 TOTP 驗證碼',
            };
        }
        const body = await res.json().catch(() => ({}));
        return {
            ok: false,
            source: 'api',
            error: body.error || '刪除失敗',
        };
    } catch {
        return { ok: false, source: 'network', error: '網路錯誤' };
    }
}

export async function publishCrowdfundingPage(merchantId, pageKey, data) {
    const payload = prepareCrowdfundingPageConfig(data);
    await saveCrowdfundingPage(merchantId, pageKey, payload);
    try {
        const url =
            '/api/v1/comme/crowdfunding/id=' +
            encodeURIComponent(merchantId) +
            '/pageKey=' +
            encodeURIComponent(pageKey) +
            '/publish';
        const res = await fetch(url, {
            method: 'POST',
            headers: buildAuthHeaders(merchantId, {
                'Content-Type': 'application/json',
            }),
            body: JSON.stringify(payload),
        });
        if (res.ok) {
            return { ok: true, source: 'api' };
        }
        if (res.status === 401) {
            const body = await res.json().catch(() => ({}));
            return {
                ok: false,
                source: 'auth',
                error: body.error || '需要 TOTP 驗證碼',
            };
        }
    } catch {
        /* 網路錯誤 */
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

    throw new Error('crowdfunding_not_found');
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
