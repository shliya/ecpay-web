import './css/common.css';
import './css/ecpay-setting.css';
(function () {
    document
        .getElementById('ecpaySettingForm')
        .addEventListener('submit', async e => {
            e.preventDefault();

            const messageDiv = document.getElementById('message');
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
                    messageDiv.className = 'message success';
                    messageDiv.textContent = '設定已成功儲存！';
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

                    // 開始檢查
                    setTimeout(waitForPage, 1000);
                } else {
                    throw new Error(result.message || '儲存設定時發生錯誤');
                }
            } catch (error) {
                messageDiv.className = 'message error';
                messageDiv.textContent = error.message;
            }

            messageDiv.style.display = 'block';

            // 3秒後自動隱藏訊息
            setTimeout(() => {
                messageDiv.style.display = 'none';
            }, 3000);
        });

    // 如果需要，可以在頁面載入時讀取現有設定
    window.addEventListener('load', async () => {
        try {
            const merchantId = new URLSearchParams(window.location.search).get(
                'id'
            );
            if (merchantId) {
                document.getElementById('merchantId').value = merchantId;
                document.getElementById('merchantId').readOnly = true;
            }
        } catch (error) {
            console.error('載入設定時發生錯誤:', error);
        }
    });
})();
