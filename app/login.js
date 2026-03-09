import './css/common.css';
import './css/login.css';

(function () {
    const loginForm = document.getElementById('loginForm');
    const totpSection = document.getElementById('totpSection');
    const totpForm = document.getElementById('totpForm');
    const btnBack = document.getElementById('btnBack');
    const messageDiv = document.getElementById('message');
    const merchantIdInput = document.getElementById('merchantId');

    let currentMerchantId = '';

    function showMessage(text, type) {
        messageDiv.className = `message ${type}`;
        messageDiv.textContent = text;
        messageDiv.style.display = 'block';
    }

    function hideMessage() {
        messageDiv.style.display = 'none';
    }

    function showTotpStep() {
        loginForm.style.display = 'none';
        totpSection.style.display = 'block';
        hideMessage();
        document.getElementById('totpToken').focus();
    }

    function showLoginStep() {
        totpSection.style.display = 'none';
        loginForm.style.display = 'block';
        hideMessage();
        currentMerchantId = '';
    }

    function redirectToMain(merchantId) {
        localStorage.setItem('merchantId', merchantId);
        window.location.href = `index.html?id=${merchantId}`;
    }

    async function checkMerchant(merchantId) {
        const response = await fetch(
            `/api/v1/login/check-merchant/id=${merchantId}`
        );
        return response.json();
    }

    async function verifyTotp(merchantId, token) {
        const response = await fetch('/api/v1/login/verify-totp', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ merchantId, token }),
        });
        const data = await response.json();
        return { ok: response.ok, data };
    }

    loginForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        hideMessage();

        const merchantId = merchantIdInput.value.trim();
        if (!merchantId) {
            return;
        }

        try {
            const result = await checkMerchant(merchantId);

            if (!result.exists) {
                alert('商店不存在，給我去填那個很麻煩的資料');
                window.location.href = 'ecpay-setting.html';
                return;
            }

            currentMerchantId = merchantId;

            if (result.totpEnabled) {
                showTotpStep();
            } else {
                window.location.href = `totp-setup.html?merchantId=${encodeURIComponent(merchantId)}`;
            }
        } catch {
            showMessage('檢查商店時發生錯誤，請稍後再試', 'error');
        }
    });

    totpForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        hideMessage();

        const token = document.getElementById('totpToken').value.trim();
        if (!token || token.length !== 6) {
            showMessage('請輸入 6 位數驗證碼', 'error');
            return;
        }

        try {
            const { ok, data } = await verifyTotp(currentMerchantId, token);

            if (ok && data.success) {
                redirectToMain(currentMerchantId);
            } else {
                showMessage(data.error || '驗證失敗', 'error');
            }
        } catch {
            showMessage('驗證時發生錯誤，請稍後再試', 'error');
        }
    });

    btnBack.addEventListener('click', showLoginStep);
})();
