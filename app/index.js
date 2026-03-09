import './css/common.css';
import './css/index.css';
import richWomanImg from './assest/13.png';
import checkTotpBinding from './js/totp-guard.js';

let isInitialized = false;

let indexState = {
    merchantId: null,
    currentPage: 'home',
    viewerDonateUrl: '',
};

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
    loadViewerDonateUrl(merchantId);
    setupImages();
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

async function loadViewerDonateUrl(merchantId) {
    const inputEl = document.getElementById('viewerDonateUrl');
    if (!inputEl) {
        return;
    }

    try {
        const res = await fetch(
            `/api/v1/comme/ecpay/config/public/id=${encodeURIComponent(merchantId)}`
        );
        const data = await res.json().catch(() => ({}));
        const baseUrl = getViewerDonateBaseUrl();

        if (res.ok && data.displayName) {
            const url =
                baseUrl + '?name=' + encodeURIComponent(data.displayName);
            indexState.viewerDonateUrl = url;
            inputEl.value = url;
            inputEl.placeholder = '';
            inputEl.removeAttribute('data-no-display-name');
        } else {
            setDonateLinkPlaceholder(inputEl);
        }
    } catch {
        setDonateLinkPlaceholder(inputEl);
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

function setupImages() {
    const welcomeImg = document.querySelector('.welcome-icon img');
    if (welcomeImg) {
        welcomeImg.src = richWomanImg;
    }
}

function bindEventListeners() {
    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', () => navigateTo(item.dataset.page));
    });

    document.querySelectorAll('.home-card').forEach(card => {
        card.addEventListener('click', () => navigateTo(card.dataset.nav));
    });

    bindElement('logoutBtn', 'click', handleLogout);
    bindElement('settingsBtn', 'click', handleSettings);
    bindElement('copyDonateLinkBtn', 'click', handleCopyDonateLink);
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
        item.classList.toggle('active', item.dataset.page === page);
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
    return `${pageFile}?merchantId=${merchantId}`;
}

function buildFullUrl(pageFile) {
    const path = window.location.pathname.replace(/[^/]*$/, '');
    const merchantId = encodeURIComponent(indexState.merchantId);
    return (
        window.location.origin + path + pageFile + '?merchantId=' + merchantId
    );
}

function getLinkUrl(type, pageFile) {
    if (type === 'page-url') {
        return buildFullUrl(pageFile);
    }
    if (type === 'viewer-donate') {
        return indexState.viewerDonateUrl || '';
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
            input.placeholder = '請先至設定頁面設定顯示名稱';
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
        linksEl.appendChild(group);
    });

    toolbar.style.display = 'block';
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
        showError('請先至設定頁面設定顯示名稱後才能複製連結');
        return;
    }
    copyToClipboard(input.value, input, btn);
}

function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    if (sidebar) {
        sidebar.classList.toggle('collapsed');
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
