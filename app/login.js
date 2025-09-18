// 在檔案最上方引入 CSS
import './css/common.css';
import './css/login.css';

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
                localStorage.setItem('merchantId', merchantId);
                window.location.href = `index.html?id=${merchantId}`;
            } else {
                alert('商店不存在，給我去填那個很麻煩的綠界資料');
                window.location.href = 'ecpay-setting.html';
            }
        } catch (error) {
            messageDiv.className = 'message error';
            messageDiv.textContent = '檢查商店時發生錯誤，請稍後再試';
            messageDiv.style.display = 'block';
        }
    });
})();
