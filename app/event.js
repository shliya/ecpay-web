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

/** 跑馬燈速度：每秒捲動的像素，跟標題長短無關才不會忽快忽慢 */
const MARQUEE_PX_PER_SEC = 35;

/**
 * healthTitleScroll 這組 keyframes 裡真正在移動的比例（其餘是兩端的停留）。
 * 12% + 10% + 12% 是停留，剩下 66% 分給去程與回程。
 * 改 CSS 的百分比時這個值要跟著改，否則速度會對不上。
 */
const MARQUEE_TRAVEL_FRACTION = 0.66;

/** 位移很短時的最短循環秒數，避免短標題快速抖動 */
const MARQUEE_MIN_DURATION_SEC = 8;

/** 上一次計算跑馬燈時的狀態，用來判斷這次還要不要重算 */
const marqueeState = {
    title: null,
    viewportWidth: 0,
};

/**
 * 標題放得下就靜止置左，放不下才跑馬燈。
 *
 * 版面本身交給 CSS flex：標題區會自動縮到剩餘空間，金額不被壓縮，
 * 所以這裡只需要決定「要不要捲」以及「捲多遠、捲多久」。
 */
function calculateTextPositions() {
    const healthTitle = document.getElementById('healthTitle');
    const viewport = document.querySelector('.health-title-viewport');

    if (!healthTitle || !viewport) {
        return;
    }

    const title = healthTitle.textContent;
    const viewportWidth = viewport.clientWidth;

    // 血條每秒輪詢一次，每次都重設 class 的話動畫會不斷從頭播放，
    // 結果就是卡在開頭那段停留、看起來完全不會動。
    // 只有標題文字或可視寬度真的變了才重新計算。
    if (
        title === marqueeState.title &&
        viewportWidth === marqueeState.viewportWidth
    ) {
        return;
    }

    marqueeState.title = title;
    marqueeState.viewportWidth = viewportWidth;

    // 先還原，否則會拿到上一次動畫中的寬度
    healthTitle.classList.remove('is-scrolling');
    healthTitle.style.removeProperty('--scroll-distance');
    healthTitle.style.removeProperty('--scroll-duration');

    requestAnimationFrame(() => {
        // offsetWidth 是標題盒子的實際寬度（CSS 已設 width: max-content）；
        // 同時取 scrollWidth 的較大值，避免某些情況下盒子寬度被四捨五入
        const titleWidth = Math.max(
            healthTitle.offsetWidth,
            healthTitle.scrollWidth
        );
        const overflow = titleWidth - viewport.clientWidth;

        // 1px 以內視為放得下，避免因為四捨五入而抖動
        if (overflow <= 1) {
            return;
        }

        // 一個循環是「去 + 回」兩趟，而這兩趟只佔整個循環的 66%，
        // 其餘是兩端的停留，所以總長要除以那個比例才會是設定的速度
        const travelSec = (overflow / MARQUEE_PX_PER_SEC) * 2;
        const duration = Math.max(
            MARQUEE_MIN_DURATION_SEC,
            travelSec / MARQUEE_TRAVEL_FRACTION
        );

        healthTitle.style.setProperty('--scroll-distance', `${overflow}px`);
        healthTitle.style.setProperty('--scroll-duration', `${duration}s`);
        healthTitle.classList.add('is-scrolling');
    });
}

// 只有在 DOMContentLoaded 時初始化一次
document.addEventListener('DOMContentLoaded', initializeHealthBar, {
    once: true,
});
