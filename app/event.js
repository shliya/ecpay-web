// app/event.js
// 使用一個標記來防止重複初始化
let isInitialized = false;

// 在檔案最上方引入 CSS
import './css/common.css';
import './css/event.css';

// 儲存血條狀態
let healthBarState = {
    lastData: null,
    updateInterval: null,
    lastHealth: 100,
};

async function initializeHealthBar() {
    if (isInitialized) {
        console.log('Health bar already initialized');
        return;
    }

    function getQueryParam(name) {
        const url = new URL(window.location.href);
        return url.searchParams.get(name);
    }

    isInitialized = true;
    console.log('Initializing health bar...');

    const urlId = getQueryParam('id');
    const merchantId = urlId || localStorage.getItem('merchantId');

    if (merchantId === 'null' || merchantId === null) {
        console.error('No merchant ID found');
        return;
    }

    try {
        await loadHealthData(merchantId);

        let updateInterval = setInterval(
            () => loadHealthData(merchantId),
            5000 // 每5秒更新一次
        );

        healthBarState.updateInterval = updateInterval;

        window.addEventListener('beforeunload', () => {
            if (healthBarState.updateInterval) {
                clearInterval(healthBarState.updateInterval);
            }
        });
    } catch (error) {
        console.error('初始化失敗:', error);
    }
}

// 載入血條資料
async function loadHealthData(merchantId) {
    try {
        console.log(`Loading health data for merchant ${merchantId}...`);
        const response = await fetch(
            `/api/v1/fundraising-events/id=${merchantId}`
        );
        const eventData = await response.json();
        updateHealthBar(eventData);
    } catch (error) {
        console.error('載入血條資料失敗:', error);
    }
}

// 更新血條
function updateHealthBar(eventData) {
    try {
        const totalAmount = parseInt(eventData.totalAmount) || 1000;
        const currentCost = parseInt(eventData.cost) || 0;

        // 計算血量百分比 (cost 是受到的傷害，所以血量是 totalAmount - cost)
        const currentHealth = Math.max(0, totalAmount - currentCost);
        const healthPercentage = Math.max(
            0,
            (currentHealth / totalAmount) * 100
        );
        const healthBar = document.getElementById('healthBar');
        const healthText = document.getElementById('healthText');
        console.log(healthText);

        if (healthBar && healthText) {
            // 更新血條寬度
            healthBar.style.width = `${healthPercentage}%`;

            // 更新文字 - 顯示當前金額/總金額格式
            healthText.textContent = `${currentHealth.toLocaleString()}/${totalAmount.toLocaleString()}`;

            // 更新顏色
            updateHealthBarColor(healthBar, healthPercentage);

            // 檢查是否受到傷害
            if (healthBarState.lastHealth > healthPercentage) {
                healthBar.classList.add('damage');
                setTimeout(() => {
                    healthBar.classList.remove('damage');
                }, 300);
            }

            healthBarState.lastHealth = healthPercentage;
        }

        healthBarState.lastData = eventData;
    } catch (error) {
        console.error('更新血條失敗:', error);
    }
}

// 根據血量更新顏色
function updateHealthBarColor(healthBar, percentage) {
    // 移除所有顏色類別
    healthBar.classList.remove('low', 'medium', 'high');

    if (percentage <= 20) {
        healthBar.classList.add('low'); // 紅色
    } else if (percentage <= 40) {
        healthBar.classList.add('medium'); // 橘色
    } else {
        healthBar.classList.add('high'); // 綠色
    }
}

// 只有在 DOMContentLoaded 時初始化一次
document.addEventListener('DOMContentLoaded', initializeHealthBar, {
    once: true,
});
