// 在檔案最上方引入 CSS
import './css/common.css';

(function () {
    document.getElementById('loginForm').addEventListener('submit', async e => {
        e.preventDefault();

        const merchantId = document.getElementById('merchantId').value;
        const messageDiv = document.getElementById('message');

        try {
            // 檢查商店是否存在
            const response = await fetch(
                `/api/v1/comme/ecpay/check-merchant/id=${merchantId}`
            );
            const result = await response.json();

            if (response.ok && result.exists) {
                // 如果商店存在，導向到主頁面
                window.location.href = `index.html?id=${merchantId}`;
            } else {
                // 如果商店不存在，導向到設定頁面
                window.location.href = `ecpay-setting.html?id=${merchantId}`;
            }
        } catch (error) {
            messageDiv.className = 'message error';
            messageDiv.textContent = '檢查商店時發生錯誤，請稍後再試';
            messageDiv.style.display = 'block';
        }
    });
})();
