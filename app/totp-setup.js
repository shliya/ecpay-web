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

    const qrContainer = document.getElementById('qrContainer');
    const loadingMsg = document.getElementById('loadingMsg');
    const confirmForm = document.getElementById('confirmForm');
    const messageDiv = document.getElementById('message');

    async function loadQrCode() {
        try {
            const response = await fetch('/api/v1/login/setup-totp', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ merchantId }),
            });
            const data = await response.json();

            if (!response.ok) {
                loadingMsg.textContent = data.error || '載入失敗';
                return;
            }

            loadingMsg.style.display = 'none';
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
            loadingMsg.textContent = '載入失敗，請稍後再試';
            console.error(error);
        }
    }

    confirmForm.addEventListener('submit', async e => {
        e.preventDefault();
        const token = document.getElementById('totpToken').value.trim();
        if (!token || token.length !== 6) {
            messageDiv.className = 'message error';
            messageDiv.textContent = '請輸入6位數驗證碼';
            messageDiv.style.display = 'block';
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
                messageDiv.className = 'message error';
                messageDiv.textContent = data.error || '驗證失敗';
                messageDiv.style.display = 'block';
            }
        } catch (error) {
            messageDiv.className = 'message error';
            messageDiv.textContent = '驗證時發生錯誤，請稍後再試';
            messageDiv.style.display = 'block';
        }
    });

    loadQrCode();
})();
