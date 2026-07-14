import './css/common.css';
import './css/crowdfunding-settings.css';
import {
    fetchLargeCrowdfundingEnabled,
    getCrowdfundingActivityStatus,
    loadCrowdfundingPage,
    publishCrowdfundingPage,
    saveCrowdfundingPage,
} from './js/crowdfunding-settings-api.js';
import {
    collectContentBlocks,
    collectMilestones,
    fillAllListEditors,
    initCrowdfundingListEditors,
} from './js/crowdfunding-settings-editors.js';
import { ensureTotpSession } from './js/totp-guard.js';

/** 後台可調；贊助鈕／進度條等維持前台 CSS 預設 */
const THEME_COLOR_FIELDS = [
    { key: 'pageBg', label: '全頁背景色' },
    { key: 'sidebarBg', label: '斗內列表背景' },
];

const DEFAULT_EDITABLE_THEME = {
    pageBg: '#d4c4a8',
    sidebarBg: 'rgba(245, 240, 232, 0.82)',
};

let merchantId = '';
let pageKeyFromUrl = '';
let isNewProject = false;
let loadSource = 'api';
function getMerchantId() {
    const p = new URLSearchParams(window.location.search);
    return (
        (p.get('merchantId') || '').trim() ||
        (localStorage.getItem('merchantId') || '').trim()
    );
}

function getPageKeyFromUrl() {
    const p = new URLSearchParams(window.location.search);
    return normalizePageKeyInput(p.get('pageKey') || '');
}

function getIsNewFromUrl() {
    return new URLSearchParams(window.location.search).get('new') === '1';
}

function setPageKeyReadonly(readonly) {
    const input = document.getElementById('pageKey');
    if (input) {
        input.readOnly = !!readonly;
    }
}

function applyEditModeAfterCreate(pageKey) {
    isNewProject = false;
    pageKeyFromUrl = pageKey;
    setPageKeyReadonly(true);
    const keyLabel = document.getElementById('settingsPageKeyLabel');
    if (keyLabel) {
        keyLabel.textContent = pageKey;
    }
    const titleEl = document.querySelector('.cfs-header h1');
    if (titleEl) {
        titleEl.textContent = '大型募資設定';
    }
    const path = window.location.pathname.replace(/[^/]*$/, '');
    const url = new URL(
        window.location.origin + path + 'crowdfunding-settings.html'
    );
    url.searchParams.set('merchantId', merchantId);
    url.searchParams.set('pageKey', pageKey);
    window.history.replaceState(null, '', url.pathname + url.search);
}

function getListPageUrl() {
    const path = window.location.pathname.replace(/[^/]*$/, '');
    const url = new URL(
        window.location.origin + path + 'crowdfunding-list.html'
    );
    if (merchantId) {
        url.searchParams.set('merchantId', merchantId);
    }
    return url.pathname + url.search;
}

function showMessage(text, type) {
    const el = document.getElementById('cfsMessage');
    if (!el) {
        return;
    }
    el.textContent = text || '';
    el.className = 'cfs-message' + (type ? ' is-' + type : '');
}

function normalizePageKeyInput(raw) {
    const trimmed = String(raw || '')
        .trim()
        .toLowerCase();
    if (!/^[a-z0-9_-]{1,80}$/.test(trimmed)) {
        return null;
    }
    return trimmed;
}

function toDatetimeLocalValue(iso) {
    if (!iso) {
        return '';
    }
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) {
        return '';
    }
    const pad = (n) => String(n).padStart(2, '0');
    return (
        d.getFullYear() +
        '-' +
        pad(d.getMonth() + 1) +
        '-' +
        pad(d.getDate()) +
        'T' +
        pad(d.getHours()) +
        ':' +
        pad(d.getMinutes())
    );
}

function fromDatetimeLocalValue(value) {
    if (!value) {
        return '';
    }
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) {
        return '';
    }
    return d.toISOString();
}

function buildThemeFromForm() {
    const theme = {};
    THEME_COLOR_FIELDS.forEach(({ key }) => {
        const el = document.getElementById('theme_' + key);
        if (el && el.value.trim()) {
            theme[key] = el.value.trim();
        }
    });
    return theme;
}

function collectFormData() {
    const pageKey = normalizePageKeyInput(
        document.getElementById('pageKey').value
    );
    if (!pageKey) {
        throw new Error('pageKey 格式不正確（英數、-、_，最多 80 字）');
    }

    return {
        pageKey,
        largeFundraisingName: document
            .getElementById('largeFundraisingName')
            .value.trim(),
        title: document.getElementById('title').value.trim(),
        sponsorLabel: document.getElementById('sponsorLabel').value.trim(),
        fundraisingStartsAt: fromDatetimeLocalValue(
            document.getElementById('fundraisingStartsAt').value
        ),
        fundraisingEndsAt: fromDatetimeLocalValue(
            document.getElementById('fundraisingEndsAt').value
        ),
        manuallyClosed: document.getElementById('manuallyClosed').checked,
        backgroundImageUrl: document
            .getElementById('backgroundImageUrl')
            .value.trim(),
        heroImageUrl: document.getElementById('heroImageUrl').value.trim(),
        donorListBackgroundImageUrl: document
            .getElementById('donorListBackgroundImageUrl')
            .value.trim(),
        mainDonorListTitle: document
            .getElementById('mainDonorListTitle')
            .value.trim(),
        specialThemeRankingTitle: document
            .getElementById('specialThemeRankingTitle')
            .value.trim(),
        donorTierIcons: {
            rank1: document.getElementById('tierRank1').value.trim(),
            rank2: document.getElementById('tierRank2').value.trim(),
            rank3: document.getElementById('tierRank3').value.trim(),
            other: document.getElementById('tierOther').value.trim(),
        },
        specialThemeTierIconUrl: document
            .getElementById('specialThemeTierIconUrl')
            .value.trim(),
        theme: buildThemeFromForm(),
        contentBlocks: collectContentBlocks(),
        milestones: collectMilestones(),
    };
}

function fillThemeFields(theme) {
    const t = theme || {};
    THEME_COLOR_FIELDS.forEach(({ key }) => {
        const el = document.getElementById('theme_' + key);
        const picker = document.getElementById('theme_' + key + '_picker');
        const val = t[key] || DEFAULT_EDITABLE_THEME[key] || '';
        if (el) {
            el.value = val;
        }
        if (picker && /^#[0-9a-f]{6}$/i.test(val)) {
            picker.value = val;
        }
    });
}

function fillForm(data) {
    const d = data || {};
    document.getElementById('pageKey').value = d.pageKey || '';
    document.getElementById('largeFundraisingName').value =
        d.largeFundraisingName || '';
    document.getElementById('title').value = d.title || '';
    document.getElementById('sponsorLabel').value = d.sponsorLabel || '';
    document.getElementById('fundraisingStartsAt').value = toDatetimeLocalValue(
        d.fundraisingStartsAt
    );
    document.getElementById('fundraisingEndsAt').value = toDatetimeLocalValue(
        d.fundraisingEndsAt
    );
    document.getElementById('manuallyClosed').checked = !!d.manuallyClosed;
    document.getElementById('backgroundImageUrl').value =
        d.backgroundImageUrl || '';
    document.getElementById('heroImageUrl').value = d.heroImageUrl || '';
    document.getElementById('donorListBackgroundImageUrl').value =
        d.donorListBackgroundImageUrl || '';
    document.getElementById('mainDonorListTitle').value =
        d.mainDonorListTitle || '';
    document.getElementById('specialThemeRankingTitle').value =
        d.specialThemeRankingTitle || '';
    document.getElementById('currentTotal').value =
        d.currentTotal != null ? String(d.currentTotal) : '0';

    const icons = d.donorTierIcons || {};
    document.getElementById('tierRank1').value = icons.rank1 || '';
    document.getElementById('tierRank2').value = icons.rank2 || '';
    document.getElementById('tierRank3').value = icons.rank3 || '';
    document.getElementById('tierOther').value = icons.other || '';

    document.getElementById('specialThemeTierIconUrl').value =
        d.specialThemeTierIconUrl || '';

    fillThemeFields(d.theme);
    fillAllListEditors(d);

    updateStatusPanel(d);
    updatePublicUrl(d.pageKey || 'default');
}

function updateStatusPanel(data) {
    const status = getCrowdfundingActivityStatus(data);
    const badge = document.getElementById('activityStatusBadge');
    const detail = document.getElementById('activityStatusDetail');
    if (badge) {
        badge.textContent = status.label;
        badge.className =
            'cfs-status-badge is-' + status.key.replace(/_/g, '-');
    }
    if (detail) {
        detail.textContent = status.detail;
    }
}

function updateSourceHint() {
    const el = document.getElementById('dataSourceHint');
    if (!el) {
        return;
    }
    const labels = {
        localDraft: '目前載入：本機草稿',
        api: '目前載入：伺服器 API',
    };
    el.textContent = labels[loadSource] || '';
}

function getPublicPagePath(pageKey) {
    const path = window.location.pathname.replace(/[^/]*$/, '');
    const url = new URL(
        window.location.origin + path + 'crowdfunding-page.html'
    );
    url.searchParams.set('name', pageKey);
    return url.pathname.split('/').pop() + url.search;
}

function getPublicPageFullUrl(pageKey) {
    const path = window.location.pathname.replace(/[^/]*$/, '');
    const url = new URL(
        window.location.origin + path + 'crowdfunding-page.html'
    );
    url.searchParams.set('name', pageKey);
    return url.toString();
}

function updatePublicUrl(pageKey) {
    const input = document.getElementById('publicPageUrl');
    if (input) {
        input.value = getPublicPageFullUrl(pageKey);
    }
}

function renderThemeColorInputs() {
    const container = document.getElementById('themeColorFields');
    if (!container) {
        return;
    }
    container.innerHTML = '';

    THEME_COLOR_FIELDS.forEach(({ key, label }) => {
        const row = document.createElement('div');
        row.className = 'cfs-color-row';
        const span = document.createElement('span');
        span.textContent = label;
        const inputs = document.createElement('div');
        inputs.className = 'cfs-color-inputs';

        const color = document.createElement('input');
        color.type = 'color';
        color.id = 'theme_' + key + '_picker';

        const text = document.createElement('input');
        text.type = 'text';
        text.id = 'theme_' + key;
        text.placeholder = '#000000';

        color.addEventListener('input', function () {
            text.value = color.value;
        });
        text.addEventListener('input', function () {
            if (/^#[0-9a-f]{6}$/i.test(text.value.trim())) {
                color.value = text.value.trim();
            }
        });

        inputs.appendChild(color);
        inputs.appendChild(text);
        row.appendChild(span);
        row.appendChild(inputs);
        container.appendChild(row);
    });

}

function loadNewProjectForm() {
    fillForm({
        pageKey: '',
        theme: { ...DEFAULT_EDITABLE_THEME },
        contentBlocks: [],
        milestones: [],
    });
    fillAllListEditors({ contentBlocks: [], milestones: [] });
    updateStatusPanel({ manuallyClosed: false });
    updateSourceHint();
    const keyLabel = document.getElementById('settingsPageKeyLabel');
    if (keyLabel) {
        keyLabel.textContent = '（請填寫 pageKey 後儲存）';
    }
    showMessage('請填寫專案資料後按「儲存設定」', 'ok');
}

async function loadPage(preferDraft) {
    if (isNewProject) {
        loadNewProjectForm();
        return;
    }

    const key = pageKeyFromUrl;
    if (!key) {
        return;
    }

    showMessage('載入中…', '');
    try {
        const result = await loadCrowdfundingPage(merchantId, key, {
            preferDraft: !!preferDraft,
        });
        loadSource = result.source;
        fillForm(result.data);
        updateSourceHint();
        showMessage('已載入設定', 'ok');
    } catch {
        showMessage('載入失敗', 'error');
    }
}

async function handleSave() {
    try {
        const data = collectFormData();
        const result = await saveCrowdfundingPage(
            merchantId,
            data.pageKey,
            data
        );
        loadSource = result.source === 'api' ? 'api' : 'localDraft';
        updateSourceHint();
        updateStatusPanel(data);
        const hint =
            result.source === 'api'
                ? '已儲存至伺服器'
                : '已儲存至本機草稿（請確認 API 連線後再試）';
        showMessage(hint, 'ok');
        if (isNewProject && result.source === 'api') {
            applyEditModeAfterCreate(data.pageKey);
        }
    } catch (e) {
        showMessage(e.message || '儲存失敗', 'error');
    }
}

async function handlePublish() {
    try {
        const data = collectFormData();
        const result = await publishCrowdfundingPage(
            merchantId,
            data.pageKey,
            data
        );
        loadSource = result.source === 'api' ? 'api' : loadSource;
        updateSourceHint();
        updateStatusPanel(data);
        const hint =
            result.source === 'api'
                ? '已發布，公開募資頁可正常載入'
                : '已儲存草稿，發布至伺服器失敗請稍後再試';
        showMessage(hint, result.source === 'api' ? 'ok' : 'error');
        if (isNewProject && result.source === 'api') {
            applyEditModeAfterCreate(data.pageKey);
        }
    } catch (e) {
        showMessage(e.message || '發布失敗', 'error');
    }
}

function bindEvents() {
    document.getElementById('btnSave').addEventListener('click', handleSave);
    document
        .getElementById('btnPublish')
        .addEventListener('click', handlePublish);

    document.getElementById('btnCopyPublicUrl').addEventListener('click', function () {
        const input = document.getElementById('publicPageUrl');
        if (!input || !input.value) {
            return;
        }
        navigator.clipboard.writeText(input.value).then(
            function () {
                showMessage('已複製公開網址', 'ok');
            },
            function () {
                showMessage('複製失敗', 'error');
            }
        );
    });

    document.getElementById('btnOpenPublic').addEventListener('click', function () {
        const key =
            normalizePageKeyInput(document.getElementById('pageKey').value) ||
            'default';
        window.open(getPublicPageFullUrl(key), '_blank', 'noopener');
    });

    document.getElementById('manuallyClosed').addEventListener('change', function () {
        try {
            updateStatusPanel(collectFormData());
        } catch {
            /* ignore */
        }
    });

    const back = document.getElementById('btnBackList');
    if (back) {
        back.href = getListPageUrl();
    }

}

async function init() {
    merchantId = getMerchantId();
    pageKeyFromUrl = getPageKeyFromUrl();
    isNewProject = getIsNewFromUrl() && !pageKeyFromUrl;

    if (!merchantId) {
        window.location.href = '/login.html';
        return;
    }

    const totpOk = await ensureTotpSession(merchantId);
    if (!totpOk) return;

    if (!pageKeyFromUrl && !isNewProject) {
        window.location.href = getListPageUrl();
        return;
    }

    const titleEl = document.querySelector('.cfs-header h1');
    if (isNewProject) {
        if (titleEl) {
            titleEl.textContent = '新增大型募資專案';
        }
        setPageKeyReadonly(false);
    } else {
        const keyLabel = document.getElementById('settingsPageKeyLabel');
        if (keyLabel) {
            keyLabel.textContent = pageKeyFromUrl;
        }
        const pageKeyInput = document.getElementById('pageKey');
        if (pageKeyInput) {
            pageKeyInput.value = pageKeyFromUrl;
        }
        setPageKeyReadonly(true);
    }

    const enabled = await fetchLargeCrowdfundingEnabled(merchantId);
    if (!enabled) {
        window.location.href =
            'index.html?merchantId=' + encodeURIComponent(merchantId);
        return;
    }

    renderThemeColorInputs();
    initCrowdfundingListEditors();
    bindEvents();
    await loadPage(false);
}

init();
