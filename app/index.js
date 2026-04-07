import './css/common.css';
import './css/index.css';
import checkTotpBinding from './js/totp-guard.js';

let isInitialized = false;

let indexState = {
    merchantId: null,
    currentPage: 'home',
    viewerDonateUrl: '',
    viewerDonateYoutubeUrl: '',
    selectedDonationTypes: [1, 2, 3],
};

const DONATION_TYPE = {
    ECPAY: 1,
    YOUTUBE_SUPER_CHAT: 2,
    PAYUNI: 3,
};

const DONATION_TYPE_OPTIONS = [
    { type: DONATION_TYPE.ECPAY, label: '綠界' },
    { type: DONATION_TYPE.YOUTUBE_SUPER_CHAT, label: 'YT' },
    { type: DONATION_TYPE.PAYUNI, label: 'PAYUNI' },
];

const PAGE_CONFIG = {
    'donate-list': {
        file: 'donate-list.html',
        title: '💰 錢錢列表',
        links: [{ label: 'OBS 瀏覽器來源網址', type: 'page-url' }],
    },
    'event-list': {
        file: 'event-list.html',
        title: '📊 斗內活動列表',
        links: [],
    },
    ichiban: {
        file: 'ichiban.html',
        title: '🎰 一番賞管理',
        links: [],
    },
    'donate-theme': {
        file: 'donate-theme.html',
        title: '🎨 斗內頁顏色',
        links: [{ label: '觀眾斗內連結', type: 'viewer-donate' }],
    },
    'donation-overlay-settings': {
        file: 'donation-overlay-settings.html',
        title: '📺 OBS 斗內通知',
        links: [
            {
                label: 'OBS 瀏覽器來源（斗內通知畫面）',
                type: 'donation-overlay',
            },
        ],
    },
};

async function initializeIndex() {
    if (isInitialized) {
        return;
    }

    isInitialized = true;

    const merchantId =
        getQueryParam('merchantId') || localStorage.getItem('merchantId');

    if (!merchantId || merchantId === 'null') {
        redirectToLogin();
        return;
    }

    const totpOk = await checkTotpBinding(merchantId);
    if (!totpOk) {
        return;
    }

    indexState.merchantId = merchantId;
    localStorage.setItem('merchantId', merchantId);

    displayMerchantId(merchantId);
    loadViewerDonateUrls(merchantId);
    bindEventListeners();
}

function getQueryParam(name) {
    const url = new URL(window.location.href);
    return url.searchParams.get(name);
}

function displayMerchantId(merchantId) {
    const el = document.getElementById('merchantId');
    if (!el) {
        return;
    }
    el.textContent = merchantId;
    el.classList.remove('loading');
}

function getViewerDonateBaseUrl() {
    const path = window.location.pathname.replace(/[^/]*$/, '');
    return window.location.origin + path + 'viewer-donate.html';
}

function getViewerDonateYoutubeBaseUrl() {
    const path = window.location.pathname.replace(/[^/]*$/, '');
    return window.location.origin + path + 'viewer-donate-youtube.html';
}

async function loadViewerDonateUrls(merchantId) {
    const inputEl = document.getElementById('viewerDonateUrl');
    const ytInputEl = document.getElementById('viewerDonateYoutubeUrl');

    try {
        const res = await fetch(
            `/api/v1/comme/ecpay/config/public/id=${encodeURIComponent(merchantId)}`
        );
        const data = await res.json().catch(() => ({}));
        const baseUrl = getViewerDonateBaseUrl();
        const ytBaseUrl = getViewerDonateYoutubeBaseUrl();

        if (res.ok && data.displayName) {
            const q = '?name=' + encodeURIComponent(data.displayName);
            const url = baseUrl + q;
            const ytUrl = ytBaseUrl + q;
            indexState.viewerDonateUrl = url;
            indexState.viewerDonateYoutubeUrl = ytUrl;
            if (inputEl) {
                inputEl.value = url;
                inputEl.placeholder = '';
                inputEl.removeAttribute('data-no-display-name');
            }
            if (ytInputEl) {
                ytInputEl.value = ytUrl;
                ytInputEl.placeholder = '';
                ytInputEl.removeAttribute('data-no-display-name');
            }
        } else {
            indexState.viewerDonateUrl = '';
            indexState.viewerDonateYoutubeUrl = '';
            setDonateLinkPlaceholder(inputEl);
            setDonateLinkPlaceholder(ytInputEl);
        }
    } catch {
        indexState.viewerDonateUrl = '';
        indexState.viewerDonateYoutubeUrl = '';
        setDonateLinkPlaceholder(inputEl);
        setDonateLinkPlaceholder(ytInputEl);
    }
}

function setDonateLinkPlaceholder(inputEl) {
    if (!inputEl) {
        return;
    }
    inputEl.value = '';
    inputEl.placeholder = '請先至設定頁面設定顯示名稱後才能使用觀眾斗內連結';
    inputEl.setAttribute('data-no-display-name', '1');
}

function bindEventListeners() {
    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', () => navigateTo(item.dataset.page));
        item.addEventListener('keydown', e => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                navigateTo(item.dataset.page);
            }
        });
    });

    bindElement('logoutBtn', 'click', handleLogout);
    bindElement('settingsBtn', 'click', handleSettings);
    bindElement('copyDonateLinkBtn', 'click', handleCopyDonateLink);
    bindElement(
        'copyDonateYoutubeLinkBtn',
        'click',
        handleCopyDonateYoutubeLink
    );
    bindElement('sidebarToggle', 'click', toggleSidebar);
}

function bindElement(id, event, handler) {
    const el = document.getElementById(id);
    if (el) {
        el.addEventListener(event, handler);
    }
}

function navigateTo(page) {
    if (indexState.currentPage === page) {
        return;
    }

    indexState.currentPage = page;

    document.querySelectorAll('.nav-item').forEach(item => {
        const isActive = item.dataset.page === page && page !== 'home';
        item.classList.toggle('active', isActive);
        if (isActive) {
            item.setAttribute('aria-current', 'page');
        } else {
            item.removeAttribute('aria-current');
        }
    });

    const homeContent = document.getElementById('homeContent');
    const frame = document.getElementById('contentFrame');
    const toolbar = document.getElementById('contentToolbar');

    if (page === 'home') {
        frame.style.display = 'none';
        frame.src = '';
        if (toolbar) {
            toolbar.style.display = 'none';
        }
        homeContent.classList.add('active');
        return;
    }

    homeContent.classList.remove('active');

    const config = PAGE_CONFIG[page];
    if (!config) {
        return;
    }

    renderToolbar(config);

    const url = buildPageUrl(config.file);
    frame.src = url;
    frame.style.display = 'block';
    frame.classList.add('active');
}

function buildPageUrl(pageFile) {
    const merchantId = encodeURIComponent(indexState.merchantId);
    const url = new URL(pageFile, window.location.origin);
    url.searchParams.set('merchantId', merchantId);

    if (pageFile === 'donate-list.html') {
        const donationTypes = getDonationTypesQueryValue();
        if (donationTypes) {
            url.searchParams.set('donationTypes', donationTypes);
        }
    }

    return `${url.pathname.split('/').pop()}${url.search}`;
}

function buildFullUrl(pageFile) {
    const path = window.location.pathname.replace(/[^/]*$/, '');
    const merchantId = encodeURIComponent(indexState.merchantId);
    const url = new URL(window.location.origin + path + pageFile);
    url.searchParams.set('merchantId', merchantId);

    if (pageFile === 'donate-list.html') {
        const donationTypes = getDonationTypesQueryValue();
        if (donationTypes) {
            url.searchParams.set('donationTypes', donationTypes);
        }
    }

    return url.toString();
}

function getDonationTypesQueryValue() {
    if (!indexState.selectedDonationTypes.length) {
        return '';
    }

    return indexState.selectedDonationTypes.join(',');
}

function getLinkUrl(type, pageFile) {
    if (type === 'page-url') {
        return buildFullUrl(pageFile);
    }
    if (type === 'viewer-donate') {
        return indexState.viewerDonateUrl || '';
    }
    if (type === 'donation-overlay') {
        return buildFullUrl('donation-overlay.html');
    }
    return '';
}

function renderToolbar(config) {
    const toolbar = document.getElementById('contentToolbar');
    const titleEl = document.getElementById('toolbarTitle');
    const linksEl = document.getElementById('toolbarLinks');
    if (!toolbar || !titleEl || !linksEl) {
        return;
    }

    titleEl.textContent = config.title;
    linksEl.innerHTML = '';

    config.links.forEach(link => {
        const url = getLinkUrl(link.type, config.file);

        const group = document.createElement('div');
        group.className = 'toolbar-link-group';

        const label = document.createElement('span');
        label.className = 'toolbar-link-label';
        label.textContent = link.label;

        const row = document.createElement('div');
        row.className = 'toolbar-link-row';

        const input = document.createElement('input');
        input.type = 'text';
        input.className = 'toolbar-link-input';
        input.readOnly = true;
        input.value = url;
        if (!url) {
            if (link.type === 'viewer-donate') {
                input.placeholder = '請先至設定頁面設定顯示名稱';
                input.setAttribute('data-requires-display-name', '1');
            } else {
                input.placeholder = '';
            }
        }

        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'btn btn-copy-link';
        btn.textContent = '複製連結';
        btn.addEventListener('click', () => handleCopyToolbarLink(input, btn));

        row.appendChild(input);
        row.appendChild(btn);
        group.appendChild(label);
        group.appendChild(row);

        if (link.type === 'page-url' && config.file === 'donate-list.html') {
            const checkboxRow = createDonationTypeCheckboxRow(input);
            group.appendChild(checkboxRow);
        }

        linksEl.appendChild(group);
    });

    toolbar.style.display = 'block';
}

function createDonationTypeCheckboxRow(linkInput) {
    const row = document.createElement('div');
    row.className = 'toolbar-checkbox-row';

    DONATION_TYPE_OPTIONS.forEach(({ type, label }) => {
        const item = document.createElement('label');
        item.className = 'toolbar-checkbox-item';

        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.checked = indexState.selectedDonationTypes.includes(type);
        checkbox.addEventListener('change', () => {
            updateDonationTypeSelection(type, checkbox.checked);
            const updatedUrl = getLinkUrl('page-url', 'donate-list.html');
            linkInput.value = updatedUrl;
            refreshDonateListFrameUrl();
        });

        const text = document.createElement('span');
        text.textContent = label;

        item.appendChild(checkbox);
        item.appendChild(text);
        row.appendChild(item);
    });

    return row;
}

function updateDonationTypeSelection(type, checked) {
    if (checked) {
        if (!indexState.selectedDonationTypes.includes(type)) {
            indexState.selectedDonationTypes.push(type);
        }
    } else {
        indexState.selectedDonationTypes =
            indexState.selectedDonationTypes.filter(
                selectedType => selectedType !== type
            );
    }

    indexState.selectedDonationTypes.sort((a, b) => a - b);
}

function refreshDonateListFrameUrl() {
    if (indexState.currentPage !== 'donate-list') {
        return;
    }

    const frame = document.getElementById('contentFrame');
    if (!frame) {
        return;
    }

    frame.src = buildPageUrl('donate-list.html');
}

function copyToClipboard(text, inputEl, btn) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(
            () => flashButtonText(btn, '已複製'),
            () => inputEl.select()
        );
    } else {
        inputEl.select();
        if (document.execCommand('copy')) {
            flashButtonText(btn, '已複製');
        }
    }
}

function handleCopyToolbarLink(input, btn) {
    if (!input.value) {
        if (input.hasAttribute('data-requires-display-name')) {
            showError('請先至設定頁面設定顯示名稱後才能複製連結');
        } else {
            showError('無法複製連結');
        }
        return;
    }
    copyToClipboard(input.value, input, btn);
}

function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    const btn = document.getElementById('sidebarToggle');
    if (sidebar) {
        sidebar.classList.toggle('collapsed');
        const collapsed = sidebar.classList.contains('collapsed');
        if (btn) {
            btn.setAttribute('aria-expanded', collapsed ? 'false' : 'true');
        }
    }
}

function handleCopyDonateLink() {
    const inputEl = document.getElementById('viewerDonateUrl');
    const btn = document.getElementById('copyDonateLinkBtn');
    if (!inputEl || !btn) {
        return;
    }
    if (inputEl.hasAttribute('data-no-display-name') || !inputEl.value) {
        showError('請先至設定頁面設定顯示名稱後才能複製連結');
        return;
    }
    copyToClipboard(inputEl.value, inputEl, btn);
}

function handleCopyDonateYoutubeLink() {
    const inputEl = document.getElementById('viewerDonateYoutubeUrl');
    const btn = document.getElementById('copyDonateYoutubeLinkBtn');
    if (!inputEl || !btn) {
        return;
    }
    if (inputEl.hasAttribute('data-no-display-name') || !inputEl.value) {
        showError('請先至設定頁面設定顯示名稱後才能複製連結');
        return;
    }
    copyToClipboard(inputEl.value, inputEl, btn);
}

function flashButtonText(btn, text) {
    const orig = btn.textContent;
    btn.textContent = text;
    setTimeout(() => {
        btn.textContent = orig;
    }, 1500);
}

function handleLogout() {
    if (!confirm('確定要登出嗎？')) {
        return;
    }
    localStorage.removeItem('merchantId');
    indexState.merchantId = null;
    redirectToLogin();
}

function handleSettings() {
    if (!indexState.merchantId) {
        showError('商店代號不存在，請重新登入');
        return;
    }
    window.location.href = `settings.html?merchantId=${encodeURIComponent(indexState.merchantId)}`;
}

function redirectToLogin() {
    window.location.href = 'login.html';
}

function showError(message) {
    const el = document.createElement('div');
    el.textContent = message;
    el.style.cssText = `
        position: fixed; top: 20px; right: 20px;
        background: #ffebee; color: #c62828;
        padding: 15px 20px; border-radius: 6px;
        border-left: 4px solid #c62828;
        z-index: 1000; box-shadow: 0 4px 12px rgba(0,0,0,0.2);
        animation: slideIn 0.3s ease-out;
    `;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 3000);
}

document.addEventListener('DOMContentLoaded', () => initializeIndex(), {
    once: true,
});

document.addEventListener('visibilitychange', () => {
    if (!document.hidden && indexState.merchantId) {
        displayMerchantId(indexState.merchantId);
    }
});

window.addEventListener('popstate', () => {
    isInitialized = false;
    initializeIndex();
});

window.indexUtils = {
    getMerchantId: () => indexState.merchantId,
    navigateTo,
    logout: handleLogout,
};
