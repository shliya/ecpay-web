import './css/crowdfunding-list.css';
import checkTotpBinding, {
    requireTotpVerification,
} from './js/totp-guard.js';
import {
    deleteCrowdfundingPage,
    fetchCrowdfundingList,
    fetchLargeCrowdfundingEnabled,
} from './js/crowdfunding-settings-api.js';

let merchantId = '';

function getMerchantId() {
    const p = new URLSearchParams(window.location.search);
    return (
        (p.get('merchantId') || '').trim() ||
        (localStorage.getItem('merchantId') || '').trim()
    );
}

function escapeHtml(s) {
    const d = document.createElement('div');
    d.textContent = s == null ? '' : String(s);
    return d.innerHTML;
}

function formatMoney(n) {
    const num = Number(n);
    if (!Number.isFinite(num)) {
        return '$0';
    }
    return '$' + Math.floor(num).toLocaleString('zh-TW');
}

function statusClass(key) {
    return 'cfl-status is-' + String(key || 'active').replace(/_/g, '-');
}

function getSettingsUrl(pageKey) {
    const path = window.location.pathname.replace(/[^/]*$/, '');
    const url = new URL(
        window.location.origin + path + 'crowdfunding-settings.html'
    );
    url.searchParams.set('merchantId', merchantId);
    if (pageKey) {
        url.searchParams.set('pageKey', pageKey);
    } else {
        url.searchParams.set('new', '1');
    }
    return url.pathname + url.search;
}

function showLoading(show) {
    const el = document.getElementById('cflLoading');
    if (el) {
        el.hidden = !show;
    }
}

function showError(msg) {
    const el = document.getElementById('cflError');
    if (!el) {
        return;
    }
    if (msg) {
        el.textContent = msg;
        el.hidden = false;
    } else {
        el.hidden = true;
        el.textContent = '';
    }
}

function createCard(page) {
    const name =
        page.largeFundraisingName || page.title || page.pageKey || '未命名';
    const status = page.activityStatus || { key: 'active', label: '進行中' };
    const progress =
        page.progressPercent != null ? Number(page.progressPercent) : null;
    const progressHtml =
        progress != null
            ? `<div class="cfl-progress">
                <div class="cfl-progress-bar">
                    <div class="cfl-progress-fill" style="width:${Math.min(100, Math.max(0, progress))}%"></div>
                </div>
                <div class="cfl-progress-text">募資進度 ${progress}% · 累積 ${formatMoney(page.currentTotal)}</div>
               </div>`
            : `<div class="cfl-progress-text">累積 ${formatMoney(page.currentTotal)}</div>`;

    return `
        <article class="cfl-card" data-page-key="${escapeHtml(page.pageKey)}" tabindex="0">
            <div class="cfl-card-header">
                <div>
                    <h3 class="cfl-card-title">${escapeHtml(name)}</h3>
                    <div class="cfl-card-key">${escapeHtml(page.pageKey)}</div>
                </div>
                <div class="cfl-badges">
                    <span class="${statusClass(status.key)}">${escapeHtml(status.label)}</span>
                    <span class="cfl-publish ${page.isPublished ? 'is-live' : ''}">${page.isPublished ? '已發布' : '未發布'}</span>
                </div>
            </div>
            <p class="cfl-meta">${escapeHtml(page.periodLabel || '—')}</p>
            ${progressHtml}
            <div class="cfl-card-actions">
                <button type="button" class="cfl-btn-delete" data-page-key="${escapeHtml(page.pageKey)}" data-page-name="${escapeHtml(name)}">
                    刪除專案
                </button>
                <button type="button" class="btn btn-primary cfl-btn-open" data-page-key="${escapeHtml(page.pageKey)}">
                    進入設定
                </button>
            </div>
        </article>
    `;
}

function renderList(pages) {
    const container = document.getElementById('cflList');
    if (!container) {
        return;
    }
    if (!pages || pages.length === 0) {
        container.innerHTML =
            '<div class="empty-state"><p>尚無大型募資專案，請按「新增專案」建立</p></div>';
        return;
    }
    container.innerHTML = pages.map(createCard).join('');

    container.querySelectorAll('.cfl-btn-delete').forEach(btn => {
        btn.addEventListener('click', e => {
            e.stopPropagation();
            const key = btn.getAttribute('data-page-key');
            const name = btn.getAttribute('data-page-name') || key;
            if (key) {
                handleDeleteProject(key, name);
            }
        });
    });

    container.querySelectorAll('.cfl-card, .cfl-btn-open').forEach(el => {
        const open = e => {
            const key =
                e.currentTarget.getAttribute('data-page-key') ||
                e.currentTarget.closest('.cfl-card')?.getAttribute('data-page-key');
            if (key) {
                window.location.href = getSettingsUrl(key);
            }
        };
        if (el.classList.contains('cfl-card')) {
            el.addEventListener('click', e => {
                if (
                    e.target.closest('.cfl-btn-open') ||
                    e.target.closest('.cfl-btn-delete')
                ) {
                    return;
                }
                open(e);
            });
            el.addEventListener('keydown', e => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    open(e);
                }
            });
        } else {
            el.addEventListener('click', e => {
                e.stopPropagation();
                open(e);
            });
        }
    });
}

async function handleDeleteProject(pageKey, displayName) {
    const msg =
        '確定要刪除專案「' +
        displayName +
        '」嗎？\n\n刪除後將不再顯示於列表，公開頁也無法存取。';
    if (!window.confirm(msg)) {
        return;
    }

    const totpOk = await requireTotpVerification(merchantId);
    if (!totpOk) {
        return;
    }

    showError('');
    const result = await deleteCrowdfundingPage(merchantId, pageKey);
    if (result.ok) {
        await loadList();
        return;
    }
    if (result.source === 'auth') {
        showError(result.error || '需要 TOTP 驗證');
        return;
    }
    showError(result.error || '刪除失敗，請稍後再試');
}

async function loadList() {
    showLoading(true);
    showError('');
    try {
        const pages = await fetchCrowdfundingList(merchantId);
        renderList(pages);
    } catch {
        showError('載入列表失敗，請稍後再試');
    } finally {
        showLoading(false);
    }
}

function bindEvents() {
    document.getElementById('btnRefresh')?.addEventListener('click', loadList);
    document.getElementById('btnCreate')?.addEventListener('click', () => {
        window.location.href = getSettingsUrl(null);
    });
}

async function init() {
    merchantId = getMerchantId();
    if (!merchantId) {
        window.location.href = '/login.html';
        return;
    }
    const label = document.getElementById('merchantIdLabel');
    if (label) {
        label.textContent = merchantId;
    }

    const totpOk = await checkTotpBinding(merchantId);
    if (!totpOk) {
        return;
    }

    const enabled = await fetchLargeCrowdfundingEnabled(merchantId);
    if (!enabled) {
        window.location.href =
            'index.html?merchantId=' + encodeURIComponent(merchantId);
        return;
    }

    bindEvents();
    await loadList();
}

init();
