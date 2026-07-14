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
    const urlMerchantId = getQueryParam('merchantId');
    const merchantId = urlMerchantId || localStorage.getItem('merchantId');
    const id = urlId || null;

    if (merchantId === 'null' || merchantId === null) {
        console.error('No merchant ID found');
        return;
    }

    try {
        await loadHealthData(merchantId, id);

        let updateInterval = setInterval(
            () => loadHealthData(merchantId, id),
            1000 // 每秒更新一次
        );

        healthBarState.updateInterval = updateInterval;

        window.addEventListener('beforeunload', () => {
            if (healthBarState.updateInterval) {
                clearInterval(healthBarState.updateInterval);
            }
        });

        window.addEventListener('resize', () => {
            calculateTextPositions();
        });
    } catch (error) {
        console.error('初始化失敗:', error);
    }
}

// 載入血條資料
async function loadHealthData(merchantId, id) {
    try {
        console.log(`Loading health data for merchant ${merchantId}...`);
        const response = await fetch(
            `/api/v1/fundraising-events/id=${id}/merchantId=${merchantId}`
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
        const eventType = parseInt(eventData.type) || 1;

        let currentHealth, healthPercentage, maxHealth;

        if (eventType === 1) {
            // type = 1 (UP): 倒扣邏輯，血量從滿血開始被扣除
            maxHealth = totalAmount;
            currentHealth = Math.max(0, totalAmount - currentCost);
            healthPercentage = Math.max(0, (currentHealth / maxHealth) * 100);
        } else if (eventType === 2 || eventType === 3) {
            // type = 2 (DOWN): 正常加法邏輯，血量從 0 開始增加
            maxHealth = totalAmount;
            currentHealth = Math.min(currentCost, totalAmount);
            healthPercentage = Math.max(0, (currentHealth / maxHealth) * 100);
        } else {
            // 預設使用 type 1 的邏輯
            maxHealth = totalAmount;
            currentHealth = Math.max(0, totalAmount - currentCost);
            healthPercentage = Math.max(0, (currentHealth / maxHealth) * 100);
        }
        const healthBar = document.getElementById('healthBar');
        const healthBarGd = document.getElementById('healthBarGd');
        const healthText = document.getElementById('healthText');
        const healthTitle = document.getElementById('healthTitle');

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
                // 檢查 cost 是否有變化
                const lastData = healthBarState.lastData;
                const lastCost = lastData ? parseInt(lastData.cost) || 0 : 0;

                if (currentCost > lastCost) {
                    // cost 增加，觸發動畫
                    const changeMessage =
                        eventType === 1
                            ? `檢測到傷害 (type 1)：cost 從 ${lastCost} 增加到 ${currentCost}，血量減少`
                            : `檢測到增長 (type 2)：cost 從 ${lastCost} 增加到 ${currentCost}，血量增加`;

                    console.log(changeMessage);

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
                    // 沒有變化，直接同步更新
                    healthBar.style.width = `${healthPercentage}%`;
                    healthBarGd.style.width = `${healthPercentage}%`;
                    updateHealthBarColor(healthBar, healthPercentage);
                    healthBarState.lastHealth = healthPercentage;
                    healthBarState.lastHealthGd = healthPercentage;
                }
            }

            // 更新文字
            if (healthText) {
                healthText.textContent = `${currentHealth.toLocaleString()}/${maxHealth.toLocaleString()}`;
            }
            if (healthTitle) {
                healthTitle.textContent = eventData.eventName;
            }
            calculateTextPositions();
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
        if (element) {
            element.classList.add('damage');
            setTimeout(() => {
                if (element) {
                    element.classList.remove('damage');
                }
            }, 300);
        }
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
    if (!healthBar) return;

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

// 動態計算文字位置，確保 10px 間距
function calculateTextPositions() {
    const healthTitle = document.getElementById('healthTitle');
    const healthText = document.getElementById('healthText');
    const container = document.querySelector('.health-bar-container');

    if (!healthTitle || !healthText || !container) {
        return;
    }

    // 獲取容器寬度
    const containerWidth = container.offsetWidth;
    const minGap = 10;
    const padding = 20;

    healthTitle.style.left = '0px';
    healthTitle.style.transform = 'none';
    healthText.style.left = '0px';
    healthText.style.transform = 'none';

    requestAnimationFrame(() => {
        const titleWidth = healthTitle.offsetWidth;
        const textWidth = healthText.offsetWidth;

        const totalWidth = titleWidth + textWidth + minGap;
        const availableWidth = containerWidth - padding * 2;

        let titleLeft, textLeft;

        if (totalWidth <= availableWidth) {
            const startX = (containerWidth - totalWidth) / 2;
            titleLeft = startX;
            textLeft = startX + titleWidth + minGap;
        } else {
            const gap = Math.max(
                5,
                Math.min(minGap, (availableWidth - titleWidth - textWidth) / 2)
            );
            titleLeft = padding;
            textLeft = Math.min(
                containerWidth - textWidth - padding,
                titleLeft + titleWidth + gap
            );
        }

        healthTitle.style.left = `${titleLeft}px`;
        healthTitle.style.transform = 'none';
        healthText.style.left = `${textLeft}px`;
        healthText.style.transform = 'none';
    });
}

// 只有在 DOMContentLoaded 時初始化一次
document.addEventListener('DOMContentLoaded', initializeHealthBar, {
    once: true,
});
