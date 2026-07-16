import './css/common.css';
import './css/login.css';
import './css/totp-setup.css';

(function () {
    function getQueryParam(name) {
        const url = new URL(window.location.href);
        return url.searchParams.get(name);
    }

    const merchantId = getQueryParam('merchantId');
    if (!merchantId) {
        window.location.href = '/login.html';
        return;
    }

    const ownershipForm = document.getElementById('ownershipForm');
    const qrContainer = document.getElementById('qrContainer');
    const loadingMsg = document.getElementById('loadingMsg');
    const confirmForm = document.getElementById('confirmForm');
    const messageDiv = document.getElementById('message');

    function showMessage(text, isError) {
        messageDiv.className = isError ? 'message error' : 'message';
        messageDiv.textContent = text;
        messageDiv.style.display = 'block';
    }

    async function loadQrCode(hashKey, payuniHashKey) {
        loadingMsg.style.display = 'block';
        loadingMsg.textContent = '載入中...';
        messageDiv.style.display = 'none';

        try {
            const response = await fetch('/api/v1/login/setup-totp', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    merchantId,
                    hashKey: hashKey || undefined,
                    payuniHashKey: payuniHashKey || undefined,
                }),
            });
            const data = await response.json();

            if (!response.ok) {
                loadingMsg.style.display = 'none';
                showMessage(data.error || '載入失敗', true);
                return;
            }

            loadingMsg.style.display = 'none';
            ownershipForm.style.display = 'none';
            qrContainer.style.display = 'block';
            confirmForm.style.display = 'block';

            const QRCode = (await import('qrcode')).default;
            const qrEl = document.getElementById('qrCode');
            qrEl.innerHTML = '';
            const canvas = document.createElement('canvas');
            await QRCode.toCanvas(canvas, data.otpauthUrl, {
                width: 200,
                margin: 2,
            });
            qrEl.appendChild(canvas);

            const manualSecret = document.getElementById('manualSecret');
            if (manualSecret) manualSecret.textContent = data.secret || '';
        } catch (error) {
            loadingMsg.style.display = 'none';
            showMessage('載入失敗，請稍後再試', true);
            console.error(error);
        }
    }

    ownershipForm.addEventListener('submit', async e => {
        e.preventDefault();
        const hashKey = document.getElementById('hashKey').value.trim();
        const payuniHashKey = document
            .getElementById('payuniHashKey')
            .value.trim();
        if (!hashKey && !payuniHashKey) {
            showMessage('請填寫綠界或 PayUni 的 Hash Key', true);
            return;
        }
        await loadQrCode(hashKey, payuniHashKey);
    });

    confirmForm.addEventListener('submit', async e => {
        e.preventDefault();
        const token = document.getElementById('totpToken').value.trim();
        if (!token || token.length !== 6) {
            showMessage('請輸入6位數驗證碼', true);
            return;
        }

        try {
            const response = await fetch('/api/v1/login/confirm-totp', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ merchantId, token }),
            });
            const data = await response.json();

            if (response.ok && data.success) {
                localStorage.setItem('merchantId', merchantId);
                window.location.href = `index.html?id=${merchantId}`;
            } else {
                showMessage(data.error || '驗證失敗', true);
            }
        } catch (error) {
            showMessage('驗證時發生錯誤，請稍後再試', true);
        }
    });
})();
