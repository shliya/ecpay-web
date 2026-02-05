import './css/common.css';
import './css/settings.css';

(function () {
    let merchantId = null;
    let currentConfig = null;

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

    async function loadConfig() {
        if (!merchantId) {
            showMessage('無法取得商店代號', 'error');
            return;
        }

        try {
            const response = await fetch(
                `/api/v1/comme/ecpay/config/id=${encodeURIComponent(merchantId)}`
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

    function populateForms(config) {
        if (config.displayName) {
            const displayNameEl = document.getElementById('displayName');
            if (displayNameEl) displayNameEl.value = config.displayName || '';
        }

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

        try {
            const response = await fetch(
                `/api/v1/comme/ecpay/config/id=${encodeURIComponent(merchantId)}`,
                {
                    method: 'PATCH',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        displayName: displayName || null,
                    }),
                }
            );

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.error || '儲存失敗');
            }

            showMessage('基本設定已儲存', 'success');
            currentConfig = result;
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
                    headers: {
                        'Content-Type': 'application/json',
                    },
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
                    headers: {
                        'Content-Type': 'application/json',
                    },
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

    function handlePayuniSubmit(e) {
        e.preventDefault();
        showMessage('PAYUNi 功能尚未實作', 'info');
    }

    function initialize() {
        merchantId =
            getQueryParam('merchantId') || localStorage.getItem('merchantId');

        if (!merchantId || merchantId === 'null') {
            showMessage('無法取得商店代號，請重新登入', 'error');
            setTimeout(() => {
                window.location.href = 'login.html';
            }, 2000);
            return;
        }

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
            .addEventListener('submit', handlePayuniSubmit);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initialize);
    } else {
        initialize();
    }
})();
