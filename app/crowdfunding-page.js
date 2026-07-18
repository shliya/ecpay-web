import './css/crowdfunding-page.css';
import {
    fetchCrowdfundingPublic,
    getCrowdfundingActivityStatus,
    readCrowdfundingPreview,
    resolveRecentDonors,
    fetchDonorsTen,
    fetchDonorsSpecial,
    CROWDFUNDING_MAIN_DONOR_LIMIT,
    CROWDFUNDING_SPECIAL_THEME_DONOR_LIMIT,
} from './js/crowdfunding-settings-api.js';
import {
    formatMoney,
    renderDonorList,
    isNonEmptyString,
    setupDonorListNameScroll,
} from './js/crowdfunding-donor-ui.js';
import {
    buildCrowdfundingDonorsAllUrl,
    getCrowdfundingQueryParams,
} from './js/crowdfunding-page-url.js';
import {
    renderCrowdfundingHero,
    bindCrowdfundingHeroResize,
    isCfMobileLayout,
} from './js/crowdfunding-hero.js';

const PAGE_KEY_RE = /^[a-z0-9_-]{1,80}$/i;
const DEFAULT_KEY = 'default';
/** 榜十大哥、特殊主題前四名、斗內條／累積金額 */
const LIVE_POLL_MS = 5000;

let pollTimer = null;
let pageKeyCache = null;
let pageDataCache = null;
let merchantIdCache = '';
let livePollInFlight = false;

function getQueryName() {
    return new URLSearchParams(window.location.search).get('name') || '';
}

function normalizePageKey(raw) {
    const trimmed = String(raw || '').trim();
    if (!trimmed || !PAGE_KEY_RE.test(trimmed)) {
        return null;
    }
    return trimmed.toLowerCase();
}

function isPreviewMode() {
    return (
        new URLSearchParams(window.location.search).get('preview') === '1'
    );
}

async function fetchPageData(pageKey) {
    const key = pageKey || DEFAULT_KEY;

    if (isPreviewMode()) {
        const preview = readCrowdfundingPreview(key);
        if (preview) {
            return preview;
        }
    }

    const merchantFromQuery =
        new URLSearchParams(window.location.search).get('merchantId') || '';
    try {
        const fromApi = await fetchCrowdfundingPublic(
            key,
            merchantFromQuery.trim() || undefined
        );
        if (fromApi) {
            return fromApi;
        }
    } catch (err) {
        if (err && err.message === 'not_published') {
            throw err;
        }
    }

    throw new Error('load_failed');
}

const SPONSOR_IMAGE_EXT_RE = /\.(png|jpe?g|gif|webp|svg|bmp|avif)(\?|#|$)/i;

/** sponsorLabel 為圖片 URL 時顯示圖，否則顯示文字 */
function isSponsorLabelImageUrl(v) {
    if (!isNonEmptyString(v)) return false;
    const s = v.trim();
    if (/^data:image\//i.test(s)) return true;
    const isUrl = /^https?:\/\//i.test(s) || s.startsWith('/');
    if (!isUrl) return false;
    const path = s.split('?')[0].split('#')[0];
    return SPONSOR_IMAGE_EXT_RE.test(path) || /imagekit\.io/i.test(s);
}

function applyTheme(theme) {
    const root = document.documentElement;
    const map = {
        pageBg: '--cf-page-bg',
        sidebarBg: '--cf-sidebar-bg',
        paperBg: '--cf-paper-bg',
        accent: '--cf-accent',
        accentMuted: '--cf-accent-muted',
        mutedText: '--cf-muted-text',
        milestoneTextShadow: '--cf-milestone-text-shadow',
        nodeColor: '--cf-node-color',
        nodeBorderColor: '--cf-node-border',
        pageTextColor: '--cf-page-text',
    };
    Object.entries(map).forEach(([key, cssVar]) => {
        if (theme && isNonEmptyString(theme[key])) {
            root.style.setProperty(cssVar, theme[key].trim());
        }
    });
}

function showLoadError(message) {
    const el = document.getElementById('loadError');
    const root = document.getElementById('pageRoot');
    const ended = document.getElementById('cfEndedScreen');
    if (el) {
        el.textContent = message;
        el.hidden = false;
    }
    if (root) root.hidden = true;
    if (ended) ended.hidden = true;
    document.body.classList.remove('cf-body--ended');
}

function showPage() {
    const el = document.getElementById('loadError');
    const root = document.getElementById('pageRoot');
    const ended = document.getElementById('cfEndedScreen');
    if (el) el.hidden = true;
    if (ended) ended.hidden = true;
    if (root) root.hidden = false;
    document.body.classList.remove('cf-body--ended');
}

function isPublicCrowdfundingClosed(data) {
    const status = getCrowdfundingActivityStatus(data);
    return status.key === 'ended' || status.key === 'manually_closed';
}

function showEndedScreen(data) {
    const loadError = document.getElementById('loadError');
    const root = document.getElementById('pageRoot');
    const screen = document.getElementById('cfEndedScreen');
    const msg = document.getElementById('cfEndedMessage');
    const period = document.getElementById('cfEndedPeriod');

    if (loadError) loadError.hidden = true;
    if (root) root.hidden = true;
    if (screen) screen.hidden = false;

    if (msg) {
        msg.textContent = data && data.manuallyClosed
            ? '本募資活動已由主辦方結束，感謝您的支持。'
            : '募資期間已結束，感謝您的支持。';
    }

    if (period) {
        let label = '';
        if (data && data.fundraisingStartsAt && data.fundraisingEndsAt) {
            label =
                '募資時間：' +
                data.fundraisingStartsAt +
                '－' +
                data.fundraisingEndsAt;
        }
        if (label) {
            period.textContent = label;
            period.hidden = false;
        } else {
            period.textContent = '';
            period.hidden = true;
        }
    }

    document.body.classList.add('cf-body--ended');
}

/**
 * 結束畫面：僅公開榜單（不露出贊助鈕／商戶識別）
 * @param {object} data
 * @param {string} pageKey
 */
async function renderEndedLeaderboards(data, pageKey) {
    applyTheme(data.theme || {});
    renderSponsorCta(data, 'endedSponsorCta');

    const [donors, specialDonors] = await Promise.all([
        resolveRecentDonors(pageKey),
        fetchDonorsSpecial(pageKey),
    ]);

    applyLeaderboardPanelBackground(
        document.getElementById('endedDonorListSidebar'),
        data.donorListBackgroundImageUrl
    );
    applyLeaderboardPanelBackground(
        document.getElementById('endedSpecialThemeRankingSidebar'),
        data.donorListBackgroundImageUrl
    );

    renderLeaderboardTitle(
        document.getElementById('endedMainDonorListTitle'),
        data.mainDonorListTitle,
        '榜十大哥'
    );
    const mainList = document.getElementById('endedDonorList');
    renderDonorList(
        mainList,
        data,
        (Array.isArray(donors) ? donors : []).slice(
            0,
            CROWDFUNDING_MAIN_DONOR_LIMIT
        )
    );

    const themeSidebar = document.getElementById(
        'endedSpecialThemeRankingSidebar'
    );
    const themeList = document.getElementById('endedSpecialThemeDonorList');
    const hasTitle = isNonEmptyString(data.specialThemeRankingTitle);
    const themeDonors = (Array.isArray(specialDonors) ? specialDonors : []).slice(
        0,
        CROWDFUNDING_SPECIAL_THEME_DONOR_LIMIT
    );
    const hasThemeDonors = themeDonors.length > 0;

    renderLeaderboardTitle(
        document.getElementById('endedSpecialThemeRankingTitle'),
        data.specialThemeRankingTitle,
        '特殊主題榜單'
    );
    if (themeList) {
        themeList.hidden = !hasThemeDonors;
        if (hasThemeDonors) {
            renderDonorList(themeList, data, themeDonors, {
                tierIconUrl: data.specialThemeTierIconUrl,
            });
        } else {
            themeList.innerHTML = '';
        }
    }
    if (themeSidebar) {
        if (hasTitle || hasThemeDonors) {
            themeSidebar.removeAttribute('data-placeholder');
        } else {
            themeSidebar.setAttribute('data-placeholder', 'true');
        }
    }

    setupEndedLeaderboardTabs(data, specialDonors);

    const viewAll = document.getElementById('endedViewAllDonors');
    if (viewAll && pageKey) {
        const mid =
            data && isNonEmptyString(data.merchantId)
                ? data.merchantId.trim()
                : '';
        viewAll.href = buildCrowdfundingDonorsAllUrl(pageKey, {
            merchantId: mid || undefined,
        });
        viewAll.hidden = false;
    } else if (viewAll) {
        viewAll.hidden = true;
    }
}

function setupEndedLeaderboardTabs(pageData, specialDonors) {
    const tabsRoot = document.getElementById('endedLeaderboardTabs');
    const tabMain = document.getElementById('endedLeaderboardTabMain');
    const tabTheme = document.getElementById('endedLeaderboardTabTheme');
    const mainSidebar = document.getElementById('endedDonorListSidebar');
    const themeSidebar = document.getElementById(
        'endedSpecialThemeRankingSidebar'
    );
    const leaderboardsRow =
        tabsRoot && tabsRoot.closest('.cf-leaderboards-row');

    if (!tabsRoot || !tabMain || !tabTheme || !mainSidebar || !themeSidebar) {
        return;
    }

    const themeAvailable = isSpecialThemeRankingAvailable(
        pageData,
        specialDonors
    );

    tabMain.textContent = leaderboardTabLabel(
        pageData.mainDonorListTitle,
        '榜十大哥'
    );
    tabTheme.textContent = leaderboardTabLabel(
        pageData.specialThemeRankingTitle,
        '特殊主題榜'
    );

    const applyLeaderboardTabs = function () {
        const useTabs = themeAvailable;
        tabsRoot.hidden = !useTabs;
        tabsRoot.classList.toggle('is-visible', useTabs);
        if (leaderboardsRow) {
            leaderboardsRow.classList.toggle('is-tabbed', useTabs);
        }

        if (!useTabs) {
            placeLeaderboardTabsInSidebar(tabsRoot, mainSidebar);
            mainSidebar.classList.add('is-leaderboard-panel-active');
            themeSidebar.classList.remove('is-leaderboard-panel-active');
            return;
        }

        const activeTab = tabsRoot.dataset.activeTab || 'main';
        const isMain = activeTab !== 'theme';
        const activeSidebar = isMain ? mainSidebar : themeSidebar;
        placeLeaderboardTabsInSidebar(tabsRoot, activeSidebar);
        mainSidebar.classList.toggle('is-leaderboard-panel-active', isMain);
        themeSidebar.classList.toggle('is-leaderboard-panel-active', !isMain);
        tabMain.classList.toggle('is-active', isMain);
        tabTheme.classList.toggle('is-active', !isMain);
        tabMain.setAttribute('aria-selected', String(isMain));
        tabTheme.setAttribute('aria-selected', String(!isMain));
        tabMain.tabIndex = isMain ? 0 : -1;
        tabTheme.tabIndex = !isMain ? 0 : -1;
        setupDonorListNameScroll(
            document.getElementById(
                isMain ? 'endedDonorList' : 'endedSpecialThemeDonorList'
            )
        );
    };

    if (!tabsRoot.dataset.bound) {
        tabsRoot.dataset.bound = 'true';
        tabMain.addEventListener('click', function () {
            tabsRoot.dataset.activeTab = 'main';
            applyLeaderboardTabs();
        });
        tabTheme.addEventListener('click', function () {
            tabsRoot.dataset.activeTab = 'theme';
            applyLeaderboardTabs();
        });
        window.addEventListener('resize', applyLeaderboardTabs);
    }

    applyLeaderboardTabs();
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

function buildViewerDonateUrl(data) {
    const merchantId =
        data && isNonEmptyString(data.merchantId) ?
            data.merchantId.trim()
        :   '';
    const pageId = data && data.id != null ? Number(data.id) : NaN;
    if (!merchantId || !Number.isInteger(pageId) || pageId <= 0) {
        return null;
    }
    const path = window.location.pathname.replace(/[^/]*$/, '');
    const params = new URLSearchParams({
        merchantId: merchantId,
        largeCrowdfundingPageId: String(pageId),
    });
    return (
        window.location.origin +
        path +
        'viewer-donate.html?' +
        params.toString()
    );
}

function renderSponsorCta(data, elementId) {
    const cta = document.getElementById(elementId || 'sponsorCta');
    if (!cta) return;
    const donateUrl = buildViewerDonateUrl(data);
    cta.href = donateUrl || '#';
    cta.removeAttribute('data-placeholder');
    if (!donateUrl) {
        cta.setAttribute('data-placeholder', 'true');
    }
    cta.innerHTML = '';
    cta.classList.remove('is-image', 'is-placeholder');
    cta.removeAttribute('aria-label');

    if (!isNonEmptyString(data.sponsorLabel)) {
        cta.textContent = '我要贊助（尚未設定）';
        cta.classList.add('is-placeholder');
        return;
    }

    const value = data.sponsorLabel.trim();
    if (isSponsorLabelImageUrl(value)) {
        const img = document.createElement('img');
        img.className = 'cf-sponsor-cta-img';
        img.src = value;
        img.alt =
            isNonEmptyString(data.largeFundraisingName) ?
                data.largeFundraisingName.trim() + '－我要贊助'
            :   '我要贊助';
        img.loading = 'eager';
        cta.appendChild(img);
        cta.classList.add('is-image');
        cta.setAttribute('aria-label', img.alt);
        return;
    }

    cta.textContent = value;
}

/**
 * 榜單標題文字：支援真實換行，以及設定欄輸入的字面 \\n
 * @param {string} raw
 * @returns {string}
 */
function normalizeLeaderboardTitleLabel(raw) {
    if (typeof raw !== 'string') {
        return '';
    }
    return raw
        .replace(/\r\n/g, '\n')
        .replace(/\\n/g, '\n')
        .trim();
}

/** 榜單標題：圖片 URL 顯示圖，否則顯示文字（與贊助按鈕相同規則） */
function renderLeaderboardTitle(host, labelValue, imageAlt) {
    if (!host) {
        return;
    }
    host.innerHTML = '';
    host.hidden = true;
    host.classList.remove('is-image');

    if (!isNonEmptyString(labelValue)) {
        return;
    }

    const value = normalizeLeaderboardTitleLabel(labelValue);
    if (!value) {
        return;
    }
    host.hidden = false;

    if (isSponsorLabelImageUrl(value)) {
        const img = document.createElement('img');
        img.className = 'cf-leaderboard-title__img';
        img.src = value;
        img.alt = isNonEmptyString(imageAlt) ? imageAlt.trim() : '榜單標題';
        img.loading = 'lazy';
        host.appendChild(img);
        host.classList.add('is-image');
        return;
    }

    const text = document.createElement('span');
    text.className = 'cf-leaderboard-title__text';
    text.textContent = value;
    host.appendChild(text);
}

function applyLeaderboardPanelBackground(sidebar, imageUrl) {
    if (!sidebar) {
        return;
    }

    if (isNonEmptyString(imageUrl)) {
        const url = imageUrl.trim();
        sidebar.style.backgroundImage = `url("${url}")`;
        sidebar.style.backgroundSize = '100% 100%';
        sidebar.style.backgroundPosition = 'center top';
        sidebar.style.backgroundRepeat = 'no-repeat';
        sidebar.classList.add('has-bg-image');
    } else {
        sidebar.style.backgroundImage = '';
        sidebar.style.backgroundSize = '';
        sidebar.style.backgroundPosition = '';
        sidebar.style.backgroundRepeat = '';
        sidebar.classList.remove('has-bg-image');
    }
}

/** 主榜／特殊主題榜共用同一張底圖框 */
function renderLeaderboardBackgrounds(data) {
    const imageUrl = data.donorListBackgroundImageUrl;
    applyLeaderboardPanelBackground(
        document.getElementById('donorListSidebar'),
        imageUrl
    );
    applyLeaderboardPanelBackground(
        document.getElementById('specialThemeRankingSidebar'),
        imageUrl
    );
}

function renderDonors(pageData, donors) {
    renderLeaderboardTitle(
        document.getElementById('mainDonorListTitle'),
        pageData.mainDonorListTitle,
        '榜十大哥'
    );
    const list = document.getElementById('donorList');
    const donorList = (Array.isArray(donors) ? donors : []).slice(
        0,
        CROWDFUNDING_MAIN_DONOR_LIMIT
    );
    renderDonorList(list, pageData, donorList);
}

function renderSpecialThemeRanking(pageData, donors) {
    const sidebar = document.getElementById('specialThemeRankingSidebar');
    const placeholder = document.getElementById('specialThemePlaceholder');
    const list = document.getElementById('specialThemeDonorList');
    const hasTitle = isNonEmptyString(pageData.specialThemeRankingTitle);

    renderLeaderboardTitle(
        document.getElementById('specialThemeRankingTitle'),
        pageData.specialThemeRankingTitle,
        '特殊主題榜單'
    );

    const donorList = (Array.isArray(donors) ? donors : []).slice(
        0,
        CROWDFUNDING_SPECIAL_THEME_DONOR_LIMIT
    );
    const hasDonors = donorList.length > 0;

    if (list) {
        list.hidden = !hasDonors;
        if (hasDonors) {
            renderDonorList(list, pageData, donorList, {
                tierIconUrl: pageData.specialThemeTierIconUrl,
            });
        } else {
            list.innerHTML = '';
        }
    }

    if (placeholder) {
        placeholder.hidden = hasTitle || hasDonors;
    }

    if (sidebar) {
        if (hasTitle || hasDonors) {
            sidebar.removeAttribute('data-placeholder');
        } else {
            sidebar.setAttribute('data-placeholder', 'true');
        }
    }
}

function isSpecialThemeRankingAvailable(pageData, specialDonors) {
    const hasTitle = isNonEmptyString(pageData.specialThemeRankingTitle);
    const hasDonors =
        Array.isArray(specialDonors) && specialDonors.length > 0;
    return hasTitle || hasDonors;
}

function leaderboardTabLabel(raw, fallback) {
    const value = normalizeLeaderboardTitleLabel(raw);
    return value || fallback;
}

function placeLeaderboardTabsInSidebar(tabsRoot, sidebar) {
    if (!tabsRoot || !sidebar) {
        return;
    }
    const list = sidebar.querySelector('.cf-donor-list');
    if (!list) {
        return;
    }
    if (tabsRoot.parentElement !== sidebar) {
        sidebar.insertBefore(tabsRoot, list);
        return;
    }
    if (tabsRoot.nextElementSibling !== list) {
        sidebar.insertBefore(tabsRoot, list);
    }
}

function setupLeaderboardTabs(pageData, specialDonors) {
    const tabsRoot = document.getElementById('cfLeaderboardTabs');
    const tabMain = document.getElementById('cfLeaderboardTabMain');
    const tabTheme = document.getElementById('cfLeaderboardTabTheme');
    const mainSidebar = document.getElementById('donorListSidebar');
    const themeSidebar = document.getElementById('specialThemeRankingSidebar');
    const leaderboardsRow = tabsRoot && tabsRoot.closest('.cf-leaderboards-row');

    if (
        !tabsRoot ||
        !tabMain ||
        !tabTheme ||
        !mainSidebar ||
        !themeSidebar
    ) {
        return;
    }

    const themeAvailable = isSpecialThemeRankingAvailable(
        pageData,
        specialDonors
    );

    tabMain.textContent = leaderboardTabLabel(
        pageData.mainDonorListTitle,
        '榜十大哥'
    );
    tabTheme.textContent = leaderboardTabLabel(
        pageData.specialThemeRankingTitle,
        '特殊主題榜'
    );

    const applyLeaderboardTabs = function () {
        const useTabs = themeAvailable;

        tabsRoot.hidden = !useTabs;
        tabsRoot.classList.toggle('is-visible', useTabs);
        if (leaderboardsRow) {
            leaderboardsRow.classList.toggle('is-tabbed', useTabs);
        }

        if (!useTabs) {
            placeLeaderboardTabsInSidebar(tabsRoot, mainSidebar);
            mainSidebar.classList.add('is-leaderboard-panel-active');
            themeSidebar.classList.remove('is-leaderboard-panel-active');
            mainSidebar.removeAttribute('data-leaderboard-hidden');
            themeSidebar.removeAttribute('data-leaderboard-hidden');
            tabMain.classList.remove('is-active');
            tabTheme.classList.remove('is-active');
            tabMain.setAttribute('aria-selected', 'false');
            tabTheme.setAttribute('aria-selected', 'false');
            return;
        }

        const activeTab = tabsRoot.dataset.activeTab || 'main';
        const isMain = activeTab !== 'theme';
        const activeSidebar = isMain ? mainSidebar : themeSidebar;

        placeLeaderboardTabsInSidebar(tabsRoot, activeSidebar);

        mainSidebar.classList.toggle('is-leaderboard-panel-active', isMain);
        themeSidebar.classList.toggle('is-leaderboard-panel-active', !isMain);
        mainSidebar.removeAttribute('data-leaderboard-hidden');
        themeSidebar.removeAttribute('data-leaderboard-hidden');

        tabMain.classList.toggle('is-active', isMain);
        tabTheme.classList.toggle('is-active', !isMain);
        tabMain.setAttribute('aria-selected', String(isMain));
        tabTheme.setAttribute('aria-selected', String(!isMain));
        tabMain.tabIndex = isMain ? 0 : -1;
        tabTheme.tabIndex = !isMain ? 0 : -1;

        const activeList = document.getElementById(
            isMain ? 'donorList' : 'specialThemeDonorList'
        );
        setupDonorListNameScroll(activeList);
    };

    if (!tabsRoot.dataset.bound) {
        tabsRoot.dataset.bound = 'true';
        tabMain.addEventListener('click', function () {
            tabsRoot.dataset.activeTab = 'main';
            applyLeaderboardTabs();
        });
        tabTheme.addEventListener('click', function () {
            tabsRoot.dataset.activeTab = 'theme';
            applyLeaderboardTabs();
        });
        window.addEventListener('resize', applyLeaderboardTabs);
    }

    applyLeaderboardTabs();
}

function updateFundingProgressLink(pageKey, showLink) {
    const link = document.getElementById('fundingProgressLink');
    if (!link) {
        return;
    }
    if (showLink && pageKey) {
        const { merchantId, preview } = getCrowdfundingQueryParams();
        link.href = buildCrowdfundingDonorsAllUrl(pageKey, {
            merchantId,
            preview,
        });
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        link.hidden = false;
    } else {
        link.hidden = true;
        link.removeAttribute('href');
        link.removeAttribute('target');
        link.removeAttribute('rel');
    }
}

function renderPanelHeader(data) {
    document.title = isNonEmptyString(data.title)
        ? data.title.trim()
        : isNonEmptyString(data.largeFundraisingName)
          ? data.largeFundraisingName.trim()
          : '募資計畫';
}

let contentAnchorObserver = null;
let anchorNavClickBound = false;
let contentWheelNavBound = false;
let contentWheelLocked = false;
let contentWheelUnlockTimer = null;
let anchorHighlightRaf = null;
let cfResizeTimer = null;

const CF_WHEEL_PAGE_MIN_DELTA = 28;
const CF_WHEEL_PAGE_COOLDOWN_MS = 480;

function prefersReducedScrollMotion() {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function setActiveAnchorForId(id) {
    const nav = document.getElementById('anchorNav');
    if (!nav || !id) {
        return;
    }
    nav.querySelectorAll('a[href^="#"]').forEach(function (link) {
        link.classList.toggle(
            'is-active',
            link.getAttribute('href') === '#' + id
        );
    });
}

function getContentBlocks(scroll) {
    return scroll ? scroll.querySelectorAll('.cf-content-block') : [];
}

function findActiveBlockIndex(scroll, blocks) {
    if (!scroll || !blocks.length) {
        return 0;
    }
    const viewLine = scroll.scrollTop + scroll.clientHeight * 0.38;
    let bestIdx = 0;
    let bestDist = Infinity;
    blocks.forEach(function (block, index) {
        const dist = Math.abs(block.offsetTop - viewLine);
        if (dist < bestDist) {
            bestDist = dist;
            bestIdx = index;
        }
    });
    return bestIdx;
}

function scrollBlockInPanel(scroll, block, behavior) {
    if (!scroll || !block) {
        return;
    }
    const top = Math.max(
        0,
        block.getBoundingClientRect().top -
            scroll.getBoundingClientRect().top +
            scroll.scrollTop
    );
    scroll.scrollTo({
        top: top,
        behavior: behavior || 'auto',
    });
}

function bindContentWheelNav() {
    const scroll = document.getElementById('contentScroll');
    if (!scroll || contentWheelNavBound) {
        return;
    }
    contentWheelNavBound = true;

    scroll.addEventListener(
        'wheel',
        function (e) {
            if (isCfMobileLayout()) {
                return;
            }

            const blocks = getContentBlocks(scroll);
            if (blocks.length < 2) {
                return;
            }

            const delta = e.deltaY;
            if (Math.abs(delta) < CF_WHEEL_PAGE_MIN_DELTA) {
                return;
            }

            const scrollTop = scroll.scrollTop;
            const maxScroll = scroll.scrollHeight - scroll.clientHeight;
            if (delta > 0 && scrollTop >= maxScroll - 4) {
                return;
            }
            if (delta < 0 && scrollTop <= 4) {
                return;
            }

            const current = findActiveBlockIndex(scroll, blocks);
            const next =
                delta > 0 ?
                    Math.min(current + 1, blocks.length - 1)
                :   Math.max(current - 1, 0);

            if (next === current) {
                return;
            }

            e.preventDefault();

            if (contentWheelLocked) {
                return;
            }
            contentWheelLocked = true;

            const target = blocks[next];
            setActiveAnchorForId(target.id);
            scrollBlockInPanel(
                scroll,
                target,
                prefersReducedScrollMotion() ? 'auto' : 'smooth'
            );

            clearTimeout(contentWheelUnlockTimer);
            contentWheelUnlockTimer = setTimeout(function () {
                contentWheelLocked = false;
            }, CF_WHEEL_PAGE_COOLDOWN_MS);
        },
        { passive: false }
    );
}

function bindContentAnchorNav() {
    const nav = document.getElementById('anchorNav');
    if (!nav || anchorNavClickBound) return;
    anchorNavClickBound = true;
    nav.addEventListener('click', function (e) {
        const a = e.target.closest('a[href^="#"]');
        if (!a) return;
        const id = (a.getAttribute('href') || '').slice(1);
        if (!id) return;
        const scroll = document.getElementById('contentScroll');
        const target = document.getElementById(id);
        if (!scroll || !target || !scroll.contains(target)) return;
        e.preventDefault();
        scrollContentBlockIntoView(target);
        history.replaceState(null, '', '#' + id);
        setActiveAnchorForId(id);
    });
}

function scrollContentBlockIntoView(target) {
    if (!target) {
        return;
    }
    const behavior = prefersReducedScrollMotion() ? 'auto' : 'smooth';
    if (isCfMobileLayout()) {
        const top =
            target.getBoundingClientRect().top +
            window.scrollY -
            72;
        window.scrollTo({
            top: Math.max(0, top),
            behavior: behavior,
        });
        return;
    }
    const scroll = document.getElementById('contentScroll');
    if (scroll && scroll.contains(target)) {
        scrollBlockInPanel(scroll, target, behavior);
        return;
    }
    target.scrollIntoView({ behavior: behavior, block: 'start' });
}

function updateAnchorSlideHeight() {
    if (isCfMobileLayout()) {
        document.documentElement.style.removeProperty('--cf-anchor-slide-h');
        return;
    }
    const scroll = document.getElementById('contentScroll');
    if (!scroll || scroll.clientHeight < 80) return;
    const h = scroll.clientHeight;
    document.documentElement.style.setProperty('--cf-anchor-slide-h', h + 'px');
}

function syncContentAnchorScroll(applyHashScroll) {
    const scroll = document.getElementById('contentScroll');
    const nav = document.getElementById('anchorNav');
    if (!scroll) return;

    const mobile = isCfMobileLayout();
    updateAnchorSlideHeight();

    if (contentAnchorObserver) {
        contentAnchorObserver.disconnect();
        contentAnchorObserver = null;
    }

    const blocks = scroll.querySelectorAll('.cf-content-block');
    const links = nav ? nav.querySelectorAll('a[href^="#"]') : [];
    if (blocks.length === 0) return;

    contentAnchorObserver = new IntersectionObserver(
        function (entries) {
            if (contentWheelLocked) {
                return;
            }
            let best = null;
            entries.forEach(function (entry) {
                if (!entry.isIntersecting) {
                    return;
                }
                if (
                    !best ||
                    entry.intersectionRatio > best.intersectionRatio
                ) {
                    best = entry;
                }
            });
            if (!best) {
                return;
            }
            const id = best.target.id;
            if (anchorHighlightRaf) {
                cancelAnimationFrame(anchorHighlightRaf);
            }
            anchorHighlightRaf = requestAnimationFrame(function () {
                anchorHighlightRaf = null;
                setActiveAnchorForId(id);
            });
        },
        {
            root: mobile ? null : scroll,
            rootMargin: mobile ? '0px' : '-42% 0px -42% 0px',
            threshold: mobile ? [0.2, 0.45] : [0.25, 0.5, 0.75],
        }
    );

    blocks.forEach(function (block) {
        contentAnchorObserver.observe(block);
    });

    const hash = (window.location.hash || '').replace(/^#/, '');
    if (applyHashScroll !== false && hash) {
        const target = document.getElementById(hash);
        if (target && scroll.contains(target)) {
            requestAnimationFrame(function () {
                scrollContentBlockIntoView(target);
            });
            setActiveAnchorForId(hash);
        }
    } else if (links.length > 0 && blocks[0]) {
        setActiveAnchorForId(blocks[0].id);
    }
}

function renderContentBlocks(data) {
    const scroll = document.getElementById('contentScroll');
    const emptyEl = document.getElementById('contentEmpty');
    const nav = document.getElementById('anchorNav');
    if (!scroll || !emptyEl) return;

    const blocks = Array.isArray(data.contentBlocks)
        ? [...data.contentBlocks].sort(
              (a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0)
          )
        : [];

    scroll.querySelectorAll('.cf-content-block').forEach(function (el) {
        el.remove();
    });

    if (blocks.length === 0) {
        emptyEl.hidden = false;
        if (nav) nav.hidden = true;
        return;
    }

    emptyEl.hidden = true;
    if (nav) {
        nav.innerHTML = '';
        nav.hidden = false;
    }

    blocks.forEach(function (block, index) {
        const anchorId =
            isNonEmptyString(block.anchorId) ?
                block.anchorId.trim()
            :   'section-' + (index + 1);
        const section = document.createElement('section');
        section.className = 'cf-content-block';
        section.id = anchorId;

        const hasImage = isNonEmptyString(block.imageUrl);
        const hasBody = isNonEmptyString(block.bodyText);
        if (hasImage) {
            section.classList.add('cf-content-block--has-image');
        }
        if (hasBody) {
            section.classList.add('cf-content-block--has-text');
        }
        if (hasImage && !hasBody) {
            section.classList.add('cf-content-block--image-only');
        } else if (!hasImage && hasBody) {
            section.classList.add('cf-content-block--text-only');
        } else if (hasImage && hasBody) {
            section.classList.add('cf-content-block--image-text');
        }

        if (hasImage) {
            const media = document.createElement('div');
            media.className = 'cf-content-block-media';
            const img = document.createElement('img');
            img.src = block.imageUrl.trim();
            img.alt =
                isNonEmptyString(block.anchorLabel) ?
                    block.anchorLabel.trim()
                :   '';
            img.loading = 'lazy';
            media.appendChild(img);
            section.appendChild(media);
        }

        if (hasBody) {
            const body = document.createElement('div');
            body.className = 'cf-block-body';
            body.textContent = block.bodyText.trim();
            section.appendChild(body);
        }

        scroll.appendChild(section);

        if (nav) {
            const label =
                isNonEmptyString(block.anchorLabel) ?
                    block.anchorLabel.trim()
                :   '區塊 ' + (index + 1);
            const a = document.createElement('a');
            a.href = '#' + anchorId;
            a.textContent = label;
            nav.appendChild(a);
        }
    });

    bindContentAnchorNav();
    syncContentAnchorScroll();
}

function updateTimelinePercentMarker(percentEl, fillPct) {
    if (!percentEl) {
        return;
    }
    const pctRounded = Math.round(Math.min(100, Math.max(0, fillPct)));
    percentEl.textContent = pctRounded + ' %';
}

function getFundingTargetAmount(data) {
    const milestones = Array.isArray(data.milestones) ? data.milestones : [];
    if (milestones.length === 0) {
        return 0;
    }
    const thresholds = milestones.map(function (m) {
        return Number(m.thresholdAmount) || 0;
    });
    return Math.max(...thresholds, 0);
}

function renderFundingSummary(data) {
    const el = document.getElementById('fundingSummary');
    if (!el) {
        return;
    }
    const currentTotal = Number(data.currentTotal) || 0;
    const target = getFundingTargetAmount(data);
    el.classList.toggle('is-no-target', target <= 0);
    if (target > 0) {
        el.textContent =
            '目前累積' +
            formatMoney(currentTotal) +
            ' / 達標金額' +
            formatMoney(target);
    } else {
        el.textContent = '目前累積' + formatMoney(currentTotal);
    }
}

function renderFundingProgress(data, pageKey) {
    const empty = document.getElementById('timelineEmpty');
    const track = document.getElementById('timelineTrack');
    const fill = document.getElementById('timelineFill');
    const percentEl = document.getElementById('timelinePercent');
    if (!empty || !track || !fill) {
        return;
    }

    renderFundingSummary(data);
    const key = pageKey || data.pageKey || DEFAULT_KEY;

    const milestones = Array.isArray(data.milestones)
        ? [...data.milestones].sort(
              (a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0)
          )
        : [];
    const currentTotal = Number(data.currentTotal) || 0;

    if (milestones.length === 0) {
        empty.hidden = false;
        track.hidden = true;
        fill.style.width = '0%';
        fill.classList.add('is-zero');
        updateTimelinePercentMarker(percentEl, 0);
        updateFundingProgressLink(key, false);
        return;
    }

    empty.hidden = true;
    track.hidden = false;

    const maxThreshold = Math.max(getFundingTargetAmount(data), 1);
    const fillPct = Math.min(100, (currentTotal / maxThreshold) * 100);
    fill.style.width = fillPct + '%';
    fill.classList.toggle('is-zero', fillPct <= 0);
    updateTimelinePercentMarker(percentEl, fillPct);
    updateFundingProgressLink(key, true);
}

async function renderPage(data, pageKey) {
    const key = pageKey || data.pageKey || DEFAULT_KEY;
    applyTheme(data.theme || {});
    renderBackground(data);
    renderSponsorCta(data);
    const [donors, specialDonors] = await Promise.all([
        resolveRecentDonors(key),
        fetchDonorsSpecial(key),
    ]);
    renderLeaderboardBackgrounds(data);
    renderDonors(data, donors);
    renderSpecialThemeRanking(data, specialDonors);
    setupLeaderboardTabs(data, specialDonors);
    renderCrowdfundingHero(data);
    renderPanelHeader(data);
    renderContentBlocks(data);
    renderFundingProgress(data, key);
}

function getMerchantIdFromQuery() {
    return (
        new URLSearchParams(window.location.search).get('merchantId') || ''
    ).trim();
}

/**
 * 即時區塊：榜十大哥、特殊主題前四名、募資進度條與累積金額
 */
async function refreshLiveSections() {
    if (!pageKeyCache || !pageDataCache || isPreviewMode()) {
        return;
    }
    if (livePollInFlight) {
        return;
    }
    livePollInFlight = true;
    const key = pageKeyCache;
    const merchantId = merchantIdCache || undefined;
    try {
        const [publicData, tenResult, specialDonors] = await Promise.all([
            fetchCrowdfundingPublic(key, merchantId),
            fetchDonorsTen(key),
            fetchDonorsSpecial(key),
        ]);
        if (!publicData) {
            return;
        }
        pageDataCache.currentTotal = publicData.currentTotal;
        if (Array.isArray(publicData.milestones)) {
            pageDataCache.milestones = publicData.milestones;
        }
        const donors = tenResult.donors || [];
        renderFundingProgress(pageDataCache, key);
        renderDonors(pageDataCache, donors);
        renderSpecialThemeRanking(pageDataCache, specialDonors);
        setupLeaderboardTabs(pageDataCache, specialDonors);
    } catch {
        /* 略過單次輪詢失敗 */
    } finally {
        livePollInFlight = false;
    }
}

function startLivePolling() {
    stopLivePolling();
    if (isPreviewMode() || !pageKeyCache) {
        return;
    }
    pollTimer = setInterval(function () {
        refreshLiveSections().catch(function () {});
    }, LIVE_POLL_MS);
}

function stopLivePolling() {
    if (pollTimer) {
        clearInterval(pollTimer);
        pollTimer = null;
    }
}

async function init() {
    bindContentAnchorNav();
    bindContentWheelNav();
    bindCrowdfundingHeroResize();
    window.addEventListener('resize', function () {
        clearTimeout(cfResizeTimer);
        cfResizeTimer = setTimeout(function () {
            syncContentAnchorScroll(false);
        }, 120);
    });


    const rawName = getQueryName();
    const pageKey = normalizePageKey(rawName);

    try {
        const key = pageKey || DEFAULT_KEY;
        const data = await fetchPageData(key);
        if (!isPreviewMode() && isPublicCrowdfundingClosed(data)) {
            showEndedScreen(data);
            pageKeyCache = key;
            pageDataCache = data;
            merchantIdCache = '';
            await renderEndedLeaderboards(data, key);
            return;
        }
        showPage();
        pageKeyCache = key;
        pageDataCache = data;
        merchantIdCache = getMerchantIdFromQuery();
        await renderPage(data, key);
        startLivePolling();
    } catch (err) {
        const msg =
            err && err.message === 'not_published'
                ? '此募資頁尚未發布，請至後台大型募資設定按「發布」後再開啟。'
                : '載入募資資料失敗，請確認 pageKey 是否正確且已發布。';
        showLoadError(msg);
    }
}

document.addEventListener('visibilitychange', function () {
    if (document.hidden) {
        stopLivePolling();
    } else if (pageKeyCache && pageDataCache && !isPreviewMode()) {
        refreshLiveSections().catch(function () {});
        startLivePolling();
    }
});

window.addEventListener('pagehide', function () {
    stopLivePolling();
});

init();
