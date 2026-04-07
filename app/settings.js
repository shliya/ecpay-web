import './css/common.css';
import './css/settings.css';
import { requireTotpVerification, getTotpToken } from './js/totp-guard.js';

(function () {
    let merchantId = null;
    let currentConfig = null;

    document.querySelectorAll('.password-toggle').forEach(btn => {
        btn.addEventListener('click', () => {
            const wrap = btn.closest('.password-field');
            const input = wrap.querySelector('input');
            const showLabel = btn.dataset.showLabel || '顯示密碼';
            const hideLabel = btn.dataset.hideLabel || '隱藏密碼';
            const willReveal = input.type === 'password';
            input.type = willReveal ? 'text' : 'password';
            btn.setAttribute('aria-pressed', String(willReveal));
            btn.setAttribute('aria-label', willReveal ? hideLabel : showLabel);
            wrap.classList.toggle('password-visible', willReveal);
        });
    });

    function getQueryParam(name) {
        const url = new URL(window.location.href);
        return url.searchParams.get(name);
    }

    function showMessage(text, type = 'info') {
        const messageEl = document.getElementById('settingsMessage');
        if (!messageEl) return;

        messageEl.textContent = text;
        messageEl.className = `settings-message show ${type}`;
        messageEl.style.display = 'block';

        setTimeout(() => {
            messageEl.style.display = 'none';
            messageEl.className = 'settings-message';
        }, 3000);
    }

    function buildAuthHeaders(extra = {}) {
        const headers = { ...extra };
        const token = getTotpToken();
        if (token) {
            headers['X-TOTP-Token'] = token;
        }
        return headers;
    }

    async function loadConfig() {
        if (!merchantId) {
            showMessage('無法取得商店代號', 'error');
            return;
        }

        try {
            const response = await fetch(
                `/api/v1/comme/ecpay/config/id=${encodeURIComponent(merchantId)}`,
                { headers: buildAuthHeaders() }
            );

            if (!response.ok) {
                throw new Error('載入設定失敗');
            }

            currentConfig = await response.json();
            populateForms(currentConfig);
        } catch (error) {
            console.error('載入設定錯誤:', error);
            showMessage('載入設定失敗: ' + error.message, 'error');
        }
    }

    function renderBlockedKeywordsList(keywords) {
        const listEl = document.getElementById('blockedKeywordsList');
        if (!listEl) {
            return;
        }

        if (!Array.isArray(keywords) || !keywords.length) {
            listEl.textContent = '尚未設定任何封鎖關鍵字';
            return;
        }

        listEl.textContent = '';
        keywords.forEach(keyword => {
            const span = document.createElement('span');
            span.className = 'blocked-keyword-tag';
            span.textContent = keyword;
            listEl.appendChild(span);
        });
    }

    function populateForms(config) {
        const displayNameEl = document.getElementById('displayName');
        if (displayNameEl) {
            displayNameEl.value = (config.displayName || '').trim();
        }

        const blockedKeywords =
            Array.isArray(config.blockedKeywords) && config.blockedKeywords
                ? config.blockedKeywords
                : [];

        const blockedKeywordsEl = document.getElementById('blockedKeywords');
        if (blockedKeywordsEl) {
            blockedKeywordsEl.value = blockedKeywords.join(',');
        }

        renderBlockedKeywordsList(blockedKeywords);

        const merchantIdEl = document.getElementById('merchantId');
        if (merchantIdEl) merchantIdEl.value = config.merchantId || '';

        const hashKeyEl = document.getElementById('hashKey');
        if (hashKeyEl) hashKeyEl.value = config.hashKey || '';

        const hashIVEl = document.getElementById('hashIV');
        if (hashIVEl) hashIVEl.value = config.hashIV || '';

        const youtubeHandleEl = document.getElementById('youtubeChannelHandle');
        if (youtubeHandleEl)
            youtubeHandleEl.value = config.youtubeChannelHandle || '';

        const youtubeIdEl = document.getElementById('youtubeChannelId');
        if (youtubeIdEl) youtubeIdEl.value = config.youtubeChannelId || '';

        const payuniMerchantIdEl = document.getElementById('payuniMerchantId');
        if (payuniMerchantIdEl)
            payuniMerchantIdEl.value = config.payuniMerchantId || '';

        const payuniHashKeyEl = document.getElementById('payuniHashKey');
        if (payuniHashKeyEl) payuniHashKeyEl.value = config.payuniHashKey || '';

        const payuniHashIVEl = document.getElementById('payuniHashIV');
        if (payuniHashIVEl) payuniHashIVEl.value = config.payuniHashIV || '';
    }

    function setupTabs() {
        const tabButtons = document.querySelectorAll('.tab-button');
        const tabPanels = document.querySelectorAll('.tab-panel');

        tabButtons.forEach(button => {
            button.addEventListener('click', () => {
                const targetTab = button.getAttribute('data-tab');

                tabButtons.forEach(btn => btn.classList.remove('active'));
                tabPanels.forEach(panel => panel.classList.remove('active'));

                button.classList.add('active');
                const targetPanel = document.getElementById(
                    `panel${targetTab.charAt(0).toUpperCase() + targetTab.slice(1)}`
                );
                if (targetPanel) {
                    targetPanel.classList.add('active');
                }
            });
        });
    }

    async function saveBasicSettings(e) {
        e.preventDefault();
        const displayName = document.getElementById('displayName').value.trim();
        const blockedKeywordsRaw =
            document.getElementById('blockedKeywords').value;
        const blockedKeywords = blockedKeywordsRaw
            .split(',')
            .map(keyword => keyword.trim())
            .filter(keyword => keyword);

        try {
            const response = await fetch(
                `/api/v1/comme/ecpay/config/id=${encodeURIComponent(merchantId)}`,
                {
                    method: 'PATCH',
                    headers: buildAuthHeaders({
                        'Content-Type': 'application/json',
                    }),
                    body: JSON.stringify({
                        displayName: displayName || null,
                        blockedKeywords,
                    }),
                }
            );

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.error || '儲存失敗');
            }

            showMessage('基本設定已儲存', 'success');
            currentConfig = result;
            renderBlockedKeywordsList(
                Array.isArray(result.blockedKeywords)
                    ? result.blockedKeywords
                    : []
            );
        } catch (error) {
            console.error('儲存基本設定錯誤:', error);
            showMessage('儲存失敗: ' + error.message, 'error');
        }
    }

    async function saveEcpaySettings(e) {
        e.preventDefault();
        const hashKey = document.getElementById('hashKey').value.trim();
        const hashIV = document.getElementById('hashIV').value.trim();

        if (!hashKey || !hashIV) {
            showMessage('請填寫所有必填欄位', 'error');
            return;
        }

        try {
            const response = await fetch(
                `/api/v1/comme/ecpay/config/id=${encodeURIComponent(merchantId)}`,
                {
                    method: 'PATCH',
                    headers: buildAuthHeaders({
                        'Content-Type': 'application/json',
                    }),
                    body: JSON.stringify({
                        hashKey,
                        hashIV,
                    }),
                }
            );

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.error || '儲存失敗');
            }

            showMessage('綠界設定已儲存', 'success');
            currentConfig = result;
        } catch (error) {
            console.error('儲存綠界設定錯誤:', error);
            showMessage('儲存失敗: ' + error.message, 'error');
        }
    }

    async function saveYoutubeSettings(e) {
        e.preventDefault();
        const youtubeChannelHandle = document
            .getElementById('youtubeChannelHandle')
            .value.trim();
        const youtubeChannelId = document
            .getElementById('youtubeChannelId')
            .value.trim();

        try {
            const response = await fetch(
                `/api/v1/comme/ecpay/config/id=${encodeURIComponent(merchantId)}`,
                {
                    method: 'PATCH',
                    headers: buildAuthHeaders({
                        'Content-Type': 'application/json',
                    }),
                    body: JSON.stringify({
                        youtubeChannelHandle: youtubeChannelHandle || null,
                        youtubeChannelId: youtubeChannelId || null,
                    }),
                }
            );

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.error || '儲存失敗');
            }

            showMessage('YouTube 設定已儲存', 'success');
            currentConfig = result;
        } catch (error) {
            console.error('儲存 YouTube 設定錯誤:', error);
            showMessage('儲存失敗: ' + error.message, 'error');
        }
    }

    async function savePayuniSettings(e) {
        e.preventDefault();
        const payuniMerchantId = document
            .getElementById('payuniMerchantId')
            .value.trim();
        const payuniHashKey = document.getElementById('payuniHashKey').value;
        const payuniHashIV = document.getElementById('payuniHashIV').value;

        if (!payuniMerchantId || !payuniHashKey || !payuniHashIV) {
            showMessage('請填寫所有必填欄位', 'error');
            return;
        }

        try {
            const response = await fetch(
                `/api/v1/comme/ecpay/config/id=${encodeURIComponent(merchantId)}`,
                {
                    method: 'PATCH',
                    headers: buildAuthHeaders({
                        'Content-Type': 'application/json',
                    }),
                    body: JSON.stringify({
                        payuniMerchantId,
                        payuniHashKey,
                        payuniHashIV,
                    }),
                }
            );

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.error || '儲存失敗');
            }

            showMessage('PAYUNi 設定已儲存', 'success');
            currentConfig = result;
        } catch (error) {
            console.error('儲存 PAYUNi 設定錯誤:', error);
            showMessage('儲存失敗: ' + error.message, 'error');
        }
    }

    async function initialize() {
        merchantId =
            getQueryParam('merchantId') || localStorage.getItem('merchantId');

        if (!merchantId || merchantId === 'null') {
            showMessage('無法取得商店代號，請重新登入', 'error');
            setTimeout(() => {
                window.location.href = 'login.html';
            }, 2000);
            return;
        }

        const totpOk = await requireTotpVerification(merchantId);
        if (!totpOk) return;

        setupTabs();
        loadConfig();

        document
            .getElementById('basicForm')
            .addEventListener('submit', saveBasicSettings);
        document
            .getElementById('ecpayForm')
            .addEventListener('submit', saveEcpaySettings);
        document
            .getElementById('youtubeForm')
            .addEventListener('submit', saveYoutubeSettings);
        document
            .getElementById('payuniForm')
            .addEventListener('submit', savePayuniSettings);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initialize);
    } else {
        initialize();
    }
})();
