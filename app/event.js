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
    lastHealthGd: 100,
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
        const healthBarGd = document.getElementById('healthBarGd');
        // const healthText = document.getElementById('healthText');

        if (healthBar && healthBarGd) {
            // 初始化兩個血條寬度（如果還沒設定）
            if (!healthBar.style.width) {
                healthBar.style.width = `${healthPercentage}%`;
            }
            if (!healthBarGd.style.width) {
                healthBarGd.style.width = `${healthPercentage}%`;
            }

            // 更新文字 - 顯示當前金額/總金額格式
            // healthText.textContent = `${currentHealth.toLocaleString()}/${totalAmount.toLocaleString()}`;

            // 更新顏色
            updateHealthBarColor(
                healthBar,
                parseFloat(healthBar.style.width) || healthPercentage
            );

            // 檢查是否受到傷害
            const currentHealthBarPercentage =
                parseFloat(healthBar.style.width) || healthPercentage;
            if (healthBarState.lastHealth > currentHealthBarPercentage) {
                healthBar.classList.add('damage');
                setTimeout(() => {
                    healthBar.classList.remove('damage');
                }, 300);
            }

            // 只在第一次初始化時更新狀態
            if (
                !healthBarState.lastHealth ||
                healthBarState.lastHealth === 100
            ) {
                healthBarState.lastHealth = healthPercentage;
                healthBarState.lastHealthGd = healthPercentage;
            }
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

// 減少血條寬度的函數
function reduceHealthBar() {
    const healthBar = document.getElementById('healthBar');
    const healthBarGd = document.getElementById('healthBarGd');

    if (!healthBar || !healthBarGd) {
        console.error('找不到血條元素');
        return;
    }

    // 先減少 healthBar
    reduceSpecificHealthBar(healthBar, 'healthBar');

    // 延遲 0.5 秒後減少 healthBarGd
    setTimeout(() => {
        reduceSpecificHealthBar(healthBarGd, 'healthBarGd');
    }, 500);
}

// 減少特定血條的函數
function reduceSpecificHealthBar(element, barType) {
    // 獲取當前寬度
    const currentWidth = element.style.width;
    const currentPercentage = parseFloat(currentWidth) || 100;

    // 計算新的寬度（減少50%）
    const newPercentage = Math.max(0, currentPercentage - 50);

    // 更新血條寬度
    element.style.width = `${newPercentage}%`;

    // 觸發傷害動畫
    element.classList.add('damage');
    setTimeout(() => {
        element.classList.remove('damage');
    }, 300);

    // 只有 healthBar 需要更新顏色（healthBarGd 保持固定顏色）
    if (barType === 'healthBar') {
        updateHealthBarColor(element, newPercentage);
        healthBarState.lastHealth = newPercentage;
    } else if (barType === 'healthBarGd') {
        healthBarState.lastHealthGd = newPercentage;
    }

    console.log(
        `${barType} 寬度從 ${currentPercentage}% 減少到 ${newPercentage}%`
    );
}

// 將函數添加到全域範圍，讓 HTML 可以調用
window.reduceHealthBar = reduceHealthBar;

// 只有在 DOMContentLoaded 時初始化一次
document.addEventListener('DOMContentLoaded', initializeHealthBar, {
    once: true,
});
