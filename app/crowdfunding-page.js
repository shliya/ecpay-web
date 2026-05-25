import './css/crowdfunding-page.css';
import {
    fetchCrowdfundingPublic,
    getCrowdfundingActivityStatus,
    readCrowdfundingPreview,
    resolveRecentDonors,
} from './js/crowdfunding-settings-api.js';

const PAGE_KEY_RE = /^[a-z0-9_-]{1,80}$/i;
const DEFAULT_KEY = 'default';

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

function isNonEmptyString(v) {
    return typeof v === 'string' && v.trim().length > 0;
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

function formatMoney(n) {
    const num = Number(n);
    if (!Number.isFinite(num) || num < 0) return '$0';
    return '$' + Math.floor(num).toLocaleString('zh-TW');
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
        fontFamily: '--cf-font-family',
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
        const label =
            data && isNonEmptyString(data.periodLabel) ? data.periodLabel : '';
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

function resolveDonorTierIconUrl(icons, listIndex) {
    if (!icons || typeof icons !== 'object') {
        return null;
    }
    const rank = listIndex + 1;
    let key = 'other';
    if (rank === 1) key = 'rank1';
    else if (rank === 2) key = 'rank2';
    else if (rank === 3) key = 'rank3';
    const url = icons[key];
    return isNonEmptyString(url) ? url.trim() : null;
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

function renderSponsorCta(data) {
    const cta = document.getElementById('sponsorCta');
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

function renderDonorListBackground(data) {
    const sidebar = document.querySelector('.cf-sidebar');
    if (!sidebar) return;

    if (isNonEmptyString(data.donorListBackgroundImageUrl)) {
        const url = data.donorListBackgroundImageUrl.trim();
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

function renderDonors(pageData, donors) {
    renderDonorListBackground(pageData);

    const list = document.getElementById('donorList');
    if (!list) return;
    list.innerHTML = '';
    const donorList = Array.isArray(donors) ? donors : [];
    if (donorList.length === 0) {
        const li = document.createElement('li');
        li.className = 'cf-donor-empty';
        li.textContent = '尚無斗內紀錄';
        list.appendChild(li);
        return;
    }
    const tierIcons = pageData.donorTierIcons;

    donorList.forEach(function (d, index) {
        const li = document.createElement('li');
        li.className = 'cf-donor-item';
        const tier = document.createElement('span');
        tier.className = 'cf-donor-tier';
        tier.setAttribute('aria-hidden', 'true');

        const iconUrl = resolveDonorTierIconUrl(tierIcons, index);
        if (iconUrl) {
            const img = document.createElement('img');
            img.className = 'cf-donor-tier-img';
            img.src = iconUrl;
            img.alt = '';
            img.loading = 'lazy';
            tier.appendChild(img);
            tier.classList.add('has-image');
        } else {
            tier.classList.add('cf-donor-tier--fallback');
        }

        const name = document.createElement('span');
        name.className = 'cf-donor-name';
        name.textContent =
            isNonEmptyString(d.name) ? d.name.trim() : '匿名';
        const amount = document.createElement('span');
        amount.className = 'cf-donor-amount';
        amount.textContent = formatMoney(d.amount);
        li.appendChild(tier);
        li.appendChild(name);
        li.appendChild(amount);
        list.appendChild(li);
    });
}

function setHeroFrameState(frame, hasHero) {
    if (!frame) return;
    frame.classList.toggle('has-hero', hasHero);
}

function applyHeroFloatAnimation(img) {
    if (!img) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        img.classList.remove('is-floating');
        img.style.removeProperty('--cf-hero-float-dur');
        img.style.removeProperty('--cf-hero-float-delay');
        return;
    }
    const dur = (5.5 + Math.random() * 4).toFixed(2) + 's';
    const delay = (Math.random() * 2.5).toFixed(2) + 's';
    img.style.setProperty('--cf-hero-float-dur', dur);
    img.style.setProperty('--cf-hero-float-delay', delay);
    img.classList.add('is-floating');
}

function clearHeroFloatAnimation(img) {
    if (!img) return;
    img.classList.remove('is-floating');
    img.style.removeProperty('--cf-hero-float-dur');
    img.style.removeProperty('--cf-hero-float-delay');
}

function renderHero(data) {
    const frame = document.getElementById('heroFrame');
    const img = document.getElementById('heroImg');
    const ph = document.getElementById('heroPlaceholder');
    if (!frame || !img || !ph) return;

    img.onload = null;
    img.onerror = null;

    if (!isNonEmptyString(data.heroImageUrl)) {
        img.removeAttribute('src');
        img.alt = '';
        frame.style.removeProperty('--cf-hero-ratio');
        clearHeroFloatAnimation(img);
        if (ph) ph.textContent = '主視覺圖尚未設定';
        setHeroFrameState(frame, false);
        return;
    }

    const url = data.heroImageUrl.trim();
    if (ph) ph.textContent = '主視覺圖尚未設定';
    img.alt = isNonEmptyString(data.title) ? data.title.trim() : '主視覺';
    setHeroFrameState(frame, false);

    img.onload = function () {
        if (img.naturalWidth > 0 && img.naturalHeight > 0) {
            frame.style.setProperty(
                '--cf-hero-ratio',
                img.naturalWidth + ' / ' + img.naturalHeight
            );
        }
        setHeroFrameState(frame, true);
        applyHeroFloatAnimation(img);
    };
    img.onerror = function () {
        img.removeAttribute('src');
        frame.style.removeProperty('--cf-hero-ratio');
        clearHeroFloatAnimation(img);
        setHeroFrameState(frame, false);
        if (ph) {
            ph.textContent = '主視覺圖載入失敗';
        }
    };

    if (img.src === url && img.complete && img.naturalWidth > 0) {
        img.onload();
    } else {
        img.src = url;
    }
}

function renderPanelHeader(data) {
    const logoImg = document.getElementById('logoImg');
    const logoPh = document.getElementById('logoPlaceholder');
    const titleEl = document.getElementById('pageTitle');
    const periodEl = document.getElementById('periodLabel');

    if (logoImg && logoPh) {
        if (isNonEmptyString(data.logoImageUrl)) {
            logoImg.src = data.logoImageUrl.trim();
            logoImg.alt = isNonEmptyString(data.largeFundraisingName)
                ? data.largeFundraisingName.trim()
                : 'Logo';
            logoImg.hidden = false;
            logoPh.hidden = true;
        } else {
            logoImg.removeAttribute('src');
            logoImg.hidden = true;
            logoPh.hidden = false;
        }
    }

    if (titleEl) {
        if (isNonEmptyString(data.title)) {
            titleEl.textContent = data.title.trim();
            titleEl.classList.remove('is-placeholder');
        } else {
            titleEl.textContent = '募資標題尚未設定';
            titleEl.classList.add('is-placeholder');
        }
    }

    if (periodEl) {
        let period = '';
        if (isNonEmptyString(data.periodLabel)) {
            period = data.periodLabel.trim();
        } else if (data.fundraisingStartsAt && data.fundraisingEndsAt) {
            period =
                '募資時間：' +
                data.fundraisingStartsAt +
                '－' +
                data.fundraisingEndsAt;
        }
        if (period) {
            periodEl.textContent = period;
            periodEl.classList.remove('is-placeholder');
        } else {
            periodEl.textContent = '募資期間尚未設定';
            periodEl.classList.add('is-placeholder');
        }
    }

    document.title = isNonEmptyString(data.title)
        ? data.title.trim()
        : isNonEmptyString(data.largeFundraisingName)
          ? data.largeFundraisingName.trim()
          : '募資計畫';
}

let contentAnchorObserver = null;
let anchorNavClickBound = false;
let cfResizeTimer = null;

const CF_MOBILE_MQ = '(max-width: 900px)';

function isCfMobileLayout() {
    return window.matchMedia(CF_MOBILE_MQ).matches;
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
        target.scrollIntoView({ behavior: 'smooth', block: 'start' });
        history.replaceState(null, '', '#' + id);
        nav.querySelectorAll('a[href^="#"]').forEach(function (link) {
            link.classList.toggle(
                'is-active',
                link.getAttribute('href') === '#' + id
            );
        });
    });
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
            let best = null;
            entries.forEach(function (entry) {
                if (!entry.isIntersecting) return;
                if (
                    !best ||
                    entry.intersectionRatio > best.intersectionRatio
                ) {
                    best = entry;
                }
            });
            if (!best) return;
            const id = best.target.id;
            links.forEach(function (link) {
                link.classList.toggle(
                    'is-active',
                    link.getAttribute('href') === '#' + id
                );
            });
        },
        {
            root: mobile ? null : scroll,
            threshold: mobile ? [0.15, 0.35, 0.55] : [0.45, 0.6, 0.75, 0.9],
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
                target.scrollIntoView({ block: 'start' });
            });
            links.forEach(function (link) {
                link.classList.toggle(
                    'is-active',
                    link.getAttribute('href') === '#' + hash
                );
            });
        }
    } else if (links.length > 0) {
        links[0].classList.add('is-active');
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

function renderTotal(data) {
    const el = document.getElementById('totalAmount');
    if (el) {
        el.textContent = formatMoney(data.currentTotal ?? 0);
    }
}

function renderFundingProgress(data) {
    const empty = document.getElementById('timelineEmpty');
    const track = document.getElementById('timelineTrack');
    const fill = document.getElementById('timelineFill');
    if (!empty || !track || !fill) return;

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
        return;
    }

    empty.hidden = true;
    track.hidden = false;

    const thresholds = milestones.map(function (m) {
        return Number(m.thresholdAmount) || 0;
    });
    const maxThreshold = Math.max(...thresholds, 1);
    const fillPct = Math.min(100, (currentTotal / maxThreshold) * 100);
    fill.style.width = fillPct + '%';
}

async function renderPage(data, pageKey) {
    const key = pageKey || data.pageKey || DEFAULT_KEY;
    applyTheme(data.theme || {});
    renderBackground(data);
    renderSponsorCta(data);
    const donors = await resolveRecentDonors(key);
    renderDonors(data, donors);
    renderHero(data);
    renderPanelHeader(data);
    renderContentBlocks(data);
    renderTotal(data);
    renderFundingProgress(data);
}

async function init() {
    bindContentAnchorNav();
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
            return;
        }
        showPage();
        await renderPage(data, key);
    } catch (err) {
        const msg =
            err && err.message === 'not_published'
                ? '此募資頁尚未發布，請至後台大型募資設定按「發布」後再開啟。'
                : '載入募資資料失敗，請確認 pageKey 是否正確且已發布。';
        showLoadError(msg);
    }
}

init();
