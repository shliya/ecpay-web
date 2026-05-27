import './css/crowdfunding-donors.css';
import {
    fetchCrowdfundingPublic,
    readCrowdfundingPreview,
    fetchDonorsPaged,
    CROWDFUNDING_ALL_DONORS_PAGE_SIZE,
} from './js/crowdfunding-settings-api.js';
import { renderDonorList, isNonEmptyString } from './js/crowdfunding-donor-ui.js';
import { getCrowdfundingDonorsQueryParams } from './js/crowdfunding-page-url.js';
import {
    renderCrowdfundingHero,
    bindCrowdfundingHeroResize,
} from './js/crowdfunding-hero.js';

const DEFAULT_KEY = 'default';
const POLL_MS = 5000;
let pollTimer = null;
let pageDataCache = null;
let pageKeyCache = DEFAULT_KEY;
let currentDonorPage = 1;
let paginationMeta = {
    totalCount: 0,
    totalPages: 0,
    limit: CROWDFUNDING_ALL_DONORS_PAGE_SIZE,
};

function applyTheme(theme) {
    const root = document.documentElement;
    const map = {
        pageBg: '--cf-page-bg',
        accent: '--cf-accent',
        accentMuted: '--cf-accent-muted',
        mutedText: '--cf-muted-text',
        milestoneTextShadow: '--cf-milestone-text-shadow',
        pageTextColor: '--cf-page-text',
    };
    Object.entries(map).forEach(([key, cssVar]) => {
        if (theme && isNonEmptyString(theme[key])) {
            root.style.setProperty(cssVar, theme[key].trim());
        }
    });
    if (theme && isNonEmptyString(theme.accent)) {
        root.style.setProperty('--cf-total-bar-text', theme.accent.trim());
    }
}

function renderBackground(data) {
    const bg = document.getElementById('cfBg');
    if (!bg) return;
    if (isNonEmptyString(data.backgroundImageUrl)) {
        bg.style.backgroundImage = `url("${data.backgroundImageUrl.trim()}")`;
        bg.classList.remove('is-empty');
    } else {
        bg.style.backgroundImage = '';
        bg.classList.add('is-empty');
    }
}

async function fetchPageData(pageKey, merchantId, preview) {
    const key = pageKey || DEFAULT_KEY;
    if (preview) {
        const fromPreview = readCrowdfundingPreview(key);
        if (fromPreview) {
            return fromPreview;
        }
    }
    const fromApi = await fetchCrowdfundingPublic(key, merchantId || undefined);
    if (fromApi) {
        return fromApi;
    }
    throw new Error('load_failed');
}

function showLoadError(message) {
    const el = document.getElementById('loadError');
    const root = document.getElementById('pageRoot');
    if (el) {
        el.textContent = message;
        el.hidden = false;
    }
    if (root) root.hidden = true;
}

function showPage() {
    const el = document.getElementById('loadError');
    const root = document.getElementById('pageRoot');
    if (el) el.hidden = true;
    if (root) root.hidden = false;
}

function syncDonorPageInUrl(page) {
    const params = new URLSearchParams(window.location.search);
    if (page <= 1) {
        params.delete('page');
    } else {
        params.set('page', String(page));
    }
    const qs = params.toString();
    const nextUrl =
        window.location.pathname + (qs ? '?' + qs : '') + window.location.hash;
    window.history.replaceState(null, '', nextUrl);
}

function renderPaginationControls() {
    const nav = document.getElementById('donorPagination');
    const info = document.getElementById('donorPageInfo');
    const prev = document.getElementById('donorPagePrev');
    const next = document.getElementById('donorPageNext');
    if (!nav || !info || !prev || !next) {
        return;
    }

    const totalPages = paginationMeta.totalPages;
    const totalCount = paginationMeta.totalCount;

    if (totalCount <= 0) {
        nav.hidden = true;
        return;
    }

    nav.hidden = false;
    const displayPages = Math.max(totalPages, 1);
    info.textContent =
        '第 ' +
        currentDonorPage +
        ' / ' +
        displayPages +
        ' 頁（共 ' +
        totalCount.toLocaleString('zh-TW') +
        ' 筆）';
    prev.disabled = currentDonorPage <= 1;
    next.disabled =
        totalPages > 0 ? currentDonorPage >= totalPages : true;
}

async function loadDonorPage(page) {
    const list = document.getElementById('donorListAll');
    if (!list || !pageDataCache) {
        return;
    }

    let targetPage = Math.max(1, Math.floor(Number(page)) || 1);

    const result = await fetchDonorsPaged(pageKeyCache, {
        page: targetPage,
        limit: CROWDFUNDING_ALL_DONORS_PAGE_SIZE,
    });

    if (
        result.totalPages > 0 &&
        targetPage > result.totalPages
    ) {
        targetPage = result.totalPages;
        if (targetPage !== page) {
            return loadDonorPage(targetPage);
        }
    }

    currentDonorPage = result.page || targetPage;
    paginationMeta = {
        totalCount: result.totalCount,
        totalPages: result.totalPages,
        limit: result.limit || CROWDFUNDING_ALL_DONORS_PAGE_SIZE,
    };

    const rankOffset =
        (currentDonorPage - 1) * paginationMeta.limit;

    renderDonorList(list, pageDataCache, result.donors, {
        emptyText: '尚無斗內紀錄',
        itemClass: 'cf-donor-item',
        rankOffset,
    });
    renderPaginationControls();
    syncDonorPageInUrl(currentDonorPage);
}

function bindPaginationControls() {
    const prev = document.getElementById('donorPagePrev');
    const next = document.getElementById('donorPageNext');
    if (!prev || !next) {
        return;
    }
    prev.addEventListener('click', function () {
        if (currentDonorPage <= 1) {
            return;
        }
        loadDonorPage(currentDonorPage - 1).catch(function () {});
    });
    next.addEventListener('click', function () {
        if (
            paginationMeta.totalPages > 0 &&
            currentDonorPage >= paginationMeta.totalPages
        ) {
            return;
        }
        loadDonorPage(currentDonorPage + 1).catch(function () {});
    });
}

function startPolling() {
    if (pollTimer) {
        clearInterval(pollTimer);
    }
    pollTimer = setInterval(function () {
        loadDonorPage(currentDonorPage).catch(function () {});
    }, POLL_MS);
}

async function init() {
    const { pageKey, merchantId, preview, donorPage } =
        getCrowdfundingDonorsQueryParams();
    const key = pageKey || DEFAULT_KEY;
    pageKeyCache = key;
    currentDonorPage = donorPage;

    try {
        const data = await fetchPageData(key, merchantId, preview);
        pageDataCache = data;
        applyTheme(data.theme || {});
        renderBackground(data);
        showPage();
        renderCrowdfundingHero(data);
        bindCrowdfundingHeroResize();
        bindPaginationControls();

        const titleBase =
            isNonEmptyString(data.title) ?
                data.title.trim()
            :   isNonEmptyString(data.largeFundraisingName) ?
                data.largeFundraisingName.trim()
            :   '募資計畫';
        document.title = titleBase + '－感謝贊助';

        await loadDonorPage(currentDonorPage);
        startPolling();
    } catch {
        showLoadError(
            '載入斗內列表失敗，請確認 pageKey 是否正確且募資頁已發布。'
        );
    }
}

window.addEventListener('pagehide', function () {
    if (pollTimer) {
        clearInterval(pollTimer);
        pollTimer = null;
    }
});

init();
