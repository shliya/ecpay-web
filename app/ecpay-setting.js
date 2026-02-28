import './css/common.css';
import './css/ecpay-setting.css';

(function () {
    const messageDiv = document.getElementById('message');

    function showMessage(text, isSuccess) {
        messageDiv.className = isSuccess ? 'message success' : 'message error';
        messageDiv.textContent = text;
        messageDiv.style.display = 'block';
        setTimeout(() => {
            messageDiv.style.display = 'none';
        }, 3000);
    }

    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const tab = btn.dataset.tab;
            document
                .querySelectorAll('.tab-btn')
                .forEach(b => b.classList.remove('active'));
            document
                .querySelectorAll('.tab-panel')
                .forEach(p => p.classList.remove('active'));
            btn.classList.add('active');
            document.getElementById(tab + 'Panel').classList.add('active');
        });
    });

    document
        .getElementById('ecpaySettingForm')
        .addEventListener('submit', async e => {
            e.preventDefault();

            const formData = {
                merchantId: document.getElementById('merchantId').value,
                hashKey: document.getElementById('hashKey').value,
                hashIV: document.getElementById('hashIV').value,
            };

            try {
                const response = await fetch('/api/v1/comme/ecpay/setting', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(formData),
                });

                const result = await response.json();

                if (response.ok) {
                    showMessage('設定已成功儲存！', true);
                    localStorage.setItem('merchantId', formData.merchantId);

                    messageDiv.textContent = '正在準備頁面，請稍候...';

                    const waitForPage = async () => {
                        try {
                            const apiCheck = await fetch(`/api/v1/health`);
                            if (!apiCheck.ok) {
                                throw new Error('API not ready');
                            }

                            const pageCheck = await fetch(
                                `index.html?id=${formData.merchantId}`
                            );
                            if (!pageCheck.ok) {
                                throw new Error('Page not ready');
                            }

                            window.location.href = `index.html?id=${formData.merchantId}`;
                        } catch (error) {
                            setTimeout(waitForPage, 1000);
                        }
                    };

                    setTimeout(waitForPage, 1000);
                } else {
                    throw new Error(result.message || '儲存設定時發生錯誤');
                }
            } catch (error) {
                showMessage(error.message, false);
            }
        });

    document
        .getElementById('payuniSettingForm')
        .addEventListener('submit', async e => {
            e.preventDefault();

            const formData = {
                payuniMerchantId: document
                    .getElementById('payuniMerchantId')
                    .value.trim(),
                payuniHashKey: document.getElementById('payuniHashKey').value,
                payuniHashIV: document.getElementById('payuniHashIV').value,
            };

            try {
                const response = await fetch('/api/v1/comme/payuni/setting', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify(formData),
                });

                const result = await response.json();

                if (response.ok) {
                    showMessage('PayUni 設定已成功儲存！', true);
                    localStorage.setItem(
                        'merchantId',
                        formData.payuniMerchantId
                    );

                    messageDiv.textContent = '正在準備頁面，請稍候...';

                    const waitForPage = async () => {
                        try {
                            const apiCheck = await fetch(`/api/v1/health`);
                            if (!apiCheck.ok) {
                                throw new Error('API not ready');
                            }

                            const pageCheck = await fetch(
                                `index.html?id=${encodeURIComponent(formData.payuniMerchantId)}`
                            );
                            if (!pageCheck.ok) {
                                throw new Error('Page not ready');
                            }

                            window.location.href = `index.html?id=${encodeURIComponent(formData.payuniMerchantId)}`;
                        } catch (error) {
                            setTimeout(waitForPage, 1000);
                        }
                    };

                    setTimeout(waitForPage, 1000);
                } else {
                    throw new Error(
                        result.message || result.error || '儲存設定時發生錯誤'
                    );
                }
            } catch (error) {
                showMessage(error.message, false);
            }
        });

    window.addEventListener('load', async () => {
        try {
            const merchantId = new URLSearchParams(window.location.search).get(
                'id'
            );
            if (merchantId) {
                document.getElementById('merchantId').value = merchantId;
                document.getElementById('merchantId').readOnly = true;

                const configRes = await fetch(
                    `/api/v1/comme/ecpay/config/id=${encodeURIComponent(merchantId)}`
                );
                if (configRes.ok) {
                    const config = await configRes.json();
                    if (config.payuniMerchantId) {
                        document.getElementById('payuniMerchantId').value =
                            config.payuniMerchantId;
                    }
                    if (config.payuniHashKey) {
                        document.getElementById('payuniHashKey').value =
                            config.payuniHashKey;
                    }
                    if (config.payuniHashIV) {
                        document.getElementById('payuniHashIV').value =
                            config.payuniHashIV;
                    }
                }
            }
        } catch (error) {
            console.error('載入設定時發生錯誤:', error);
        }
    });
})();
