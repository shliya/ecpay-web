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
        const healthText = document.getElementById('healthText');

        if (healthBar && healthBarGd) {
            // 檢查是否是第一次初始化
            const isFirstInit =
                !healthBar.style.width && !healthBarGd.style.width;

            if (isFirstInit) {
                // 第一次初始化，直接設定
                healthBar.style.width = `${healthPercentage}%`;
                healthBarGd.style.width = `${healthPercentage}%`;
                healthBarState.lastHealth = healthPercentage;
                healthBarState.lastHealthGd = healthPercentage;
            } else {
                // 檢查金額是否有變化（受到傷害）
                const lastData = healthBarState.lastData;
                const lastCost = lastData ? parseInt(lastData.cost) || 0 : 0;

                if (currentCost > lastCost) {
                    // 金額增加（受到傷害），觸發延遲動畫
                    console.log(
                        `檢測到傷害：從 ${lastCost} 增加到 ${currentCost}`
                    );

                    // 立即更新 healthBar
                    updateSpecificHealthBarFromAPI(
                        healthBar,
                        healthPercentage,
                        'healthBar'
                    );

                    // 延遲 0.5 秒後更新 healthBarGd
                    setTimeout(() => {
                        updateSpecificHealthBarFromAPI(
                            healthBarGd,
                            healthPercentage,
                            'healthBarGd'
                        );
                    }, 500);
                } else {
                    // 沒有傷害，直接同步更新（例如回血）
                    healthBar.style.width = `${healthPercentage}%`;
                    healthBarGd.style.width = `${healthPercentage}%`;
                    updateHealthBarColor(healthBar, healthPercentage);
                    healthBarState.lastHealth = healthPercentage;
                    healthBarState.lastHealthGd = healthPercentage;
                }
            }

            // 更新文字
            if (healthText) {
                healthText.textContent = `${currentHealth.toLocaleString()}/${totalAmount.toLocaleString()}`;
            }
        }

        healthBarState.lastData = eventData;
    } catch (error) {
        console.error('更新血條失敗:', error);
    }
}

// 從 API 更新特定血條的函數
function updateSpecificHealthBarFromAPI(element, targetPercentage, barType) {
    const currentPercentage = parseFloat(element.style.width) || 100;

    // 更新血條寬度
    element.style.width = `${targetPercentage}%`;

    // 如果是減少，觸發傷害動畫
    if (targetPercentage < currentPercentage) {
        element.classList.add('damage');
        setTimeout(() => {
            element.classList.remove('damage');
        }, 300);
    }

    // 更新狀態和顏色
    if (barType === 'healthBar') {
        updateHealthBarColor(element, targetPercentage);
        healthBarState.lastHealth = targetPercentage;
    } else if (barType === 'healthBarGd') {
        healthBarState.lastHealthGd = targetPercentage;
    }

    console.log(
        `${barType} 從 API 更新：${currentPercentage}% -> ${targetPercentage}%`
    );
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

// 示範按鈕功能 - 模擬 API 傷害數據
function reduceHealthBar() {
    // 模擬 API 回傳增加的 cost 數據
    const currentData = healthBarState.lastData;
    if (!currentData) {
        console.log('尚未載入初始數據，無法進行示範');
        return;
    }

    // 模擬增加 cost（造成傷害）
    const currentCost = parseInt(currentData.cost) || 0;
    const newCost = currentCost + 500; // 增加 500 的傷害

    // 建立模擬的事件數據
    const simulatedEventData = {
        ...currentData,
        cost: newCost,
    };

    console.log(`示範功能：模擬 cost 從 ${currentCost} 增加到 ${newCost}`);

    // 呼叫真正的更新函數，就像 API 資料更新一樣
    updateHealthBar(simulatedEventData);
}

// 將函數添加到全域範圍，讓 HTML 可以調用
window.reduceHealthBar = reduceHealthBar;

// 只有在 DOMContentLoaded 時初始化一次
document.addEventListener('DOMContentLoaded', initializeHealthBar, {
    once: true,
});
