// app/index.js
// 使用一個標記來防止重複初始化
let isInitialized = false;

// 在檔案最上方引入 CSS
import './css/common.css';
import './css/list.css';

// 儲存動畫狀態
let donationScrollState = {
    inner: null,
    cardCount: 0,
    animationStarted: false,
    lastData: [],
};

async function initializeApp() {
    if (isInitialized) {
        console.log('Already initialized');
        return;
    }

    function getQueryParam(name) {
        const url = new URL(window.location.href);
        return url.searchParams.get(name);
    }

    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            // 清除 localStorage 中的 merchantId
            localStorage.removeItem('merchantId');
            // 跳轉到登入頁面
            window.location.href = '/login.html';
        });
    }

    isInitialized = true;
    console.log('Initializing app...');
    const urlId = getQueryParam('id');
    const merchantId = urlId || localStorage.getItem('merchantId');

    if (merchantId === 'null' || merchantId === null) {
        window.location.href = '/login.html';
        return;
    }

    try {
        const checkResponse = await fetch(
            `/api/v1/comme/ecpay/check-merchant/id=${merchantId}`
        );
        const checkResult = await checkResponse.json();
        await loadDonations(merchantId);

        let updateInterval = setInterval(
            () => loadDonations(merchantId),
            10000
        );

        window.addEventListener('beforeunload', () => {
            if (updateInterval) {
                clearInterval(updateInterval);
            }
        });
    } catch (error) {
        console.error('初始化失敗:', error);
    }
}

// 將載入捐款資料的邏輯抽出成獨立函數
async function loadDonations(merchantId) {
    try {
        console.log(`Loading donations for merchant ${merchantId}...`);
        const response = await fetch(
            `/api/v1/comme/ecpay/donations/id=${merchantId}`
        );
        const donations = await response.json();
        updateDonationList(donations);
    } catch (error) {
        console.error('載入斗內資料失敗:', error);
    }
}

// 更新畫面的函數
function updateDonationList(donations) {
    try {
        const donationList = document.getElementById('donationList');
        if (!donationList) return;

        // 如果已經有 inner，且卡片數量沒變（2倍資料），直接更新內容
        let inner = donationScrollState.inner;
        const groupSize = 5;
        const needRebuild =
            !inner || inner.children.length !== donations.length * 2;

        if (needRebuild) {
            donationList.innerHTML = '';
            inner = document.createElement('div');
            inner.className = 'donation-list-inner';
            // 渲染所有卡片（原始資料）
            donations.forEach(donation => {
                inner.appendChild(createDonationCard(donation));
            });
            // 複製整份資料到最後
            // donations.forEach(donation => {
            //     inner.appendChild(createDonationCard(donation));
            // });
            donationList.appendChild(inner);
            donationScrollState.inner = inner;
            donationScrollState.cardCount = donations.length;
            donationScrollState.lastData = donations;
            donationScrollState.animationStarted = false;
        } else {
            // 只更新內容，不重建 DOM
            for (let i = 0; i < donations.length; i++) {
                updateDonationCard(inner.children[i], donations[i]);
            }
            // 複製區塊也要更新
            // for (let i = 0; i < donations.length; i++) {
            //     updateDonationCard(
            //         inner.children[donations.length + i],
            //         donations[i]
            //     );
            // }
            donationScrollState.lastData = donations;
        }

        // 啟動連續平滑滾動（只啟動一次）
        // if (!donationScrollState.animationStarted) {
        //     startDonationContinuousScroll(inner, donations.length);
        //     donationScrollState.animationStarted = true;
        // }
    } catch (error) {
        console.error('更新畫面失敗:', error);
    }
}

function createDonationCard(donation) {
    const amount = parseInt(donation.cost) || 0;
    const message = donation.message || '';
    const tier = getCustomTierClass(amount);

    const card = document.createElement('div');
    card.className = 'custom-donation-card';

    const header = document.createElement('div');
    header.className = `custom-donation-header custom-tier-header-${tier}`;

    const idSpan = document.createElement('span');
    idSpan.className = 'custom-donation-id';
    idSpan.textContent = donation.name ? `${donation.name}` : 'ID匿名';

    const amountSpan = document.createElement('span');
    amountSpan.className = 'custom-donation-amount';
    amountSpan.textContent = formatAmount(amount);

    header.appendChild(idSpan);
    header.appendChild(amountSpan);

    const messageDiv = document.createElement('div');
    messageDiv.className = `custom-donation-message custom-tier-message-${tier}`;
    messageDiv.textContent = message ? `${message}` : '';

    card.appendChild(header);
    card.appendChild(messageDiv);
    return card;
}

function updateDonationCard(card, donation) {
    const amount = parseInt(donation.cost) || 0;
    const message = donation.message || '';
    const tier = getCustomTierClass(amount);

    card.className = 'custom-donation-card';
    card.querySelector('.custom-donation-header').className =
        `custom-donation-header custom-tier-header-${tier}`;
    card.querySelector('.custom-donation-id').textContent = donation.name
        ? `${donation.name}`
        : 'ID匿名';
    card.querySelector('.custom-donation-amount').textContent =
        formatAmount(amount);
    card.querySelector('.custom-donation-message').className =
        `custom-donation-message custom-tier-message-${tier}`;
    card.querySelector('.custom-donation-message').textContent = message
        ? `${message}`
        : '';
}

// 連續平滑滾動
function startDonationContinuousScroll(inner, dataLength) {
    const cardEls = inner.getElementsByClassName('custom-donation-card');
    if (cardEls.length === 0) return;

    const groupSize = 5;
    // 用 getBoundingClientRect 取得精確高度
    const cardHeight = Math.round(cardEls[0].getBoundingClientRect().height); // 確保是整數
    const totalCards = cardEls.length;
    let scrollY = 0;

    // 設定外層高度
    const container = inner.parentElement;
    container.style.overflow = 'hidden';
    container.style.position = 'relative';
    container.style.height = `${cardHeight * groupSize}px`;

    // 初始化位置
    inner.style.transition = 'none';
    inner.style.transform = 'translateY(0)';

    let lastTimestamp = null;
    const speed = 30; // px/秒，可調整速度
    const resetPoint = cardHeight * dataLength + 70; // 重置點：原始資料的總高度

    function animate(timestamp) {
        if (!lastTimestamp) lastTimestamp = timestamp;
        const delta = timestamp - lastTimestamp;
        lastTimestamp = timestamp;

        // 計算新的滾動位置
        scrollY += (speed * delta) / 900;

        // 確保滾動位置是整數
        const currentScroll = Math.floor(scrollY);

        // 檢查是否需要重置
        if (currentScroll >= resetPoint) {
            // 計算超出的距離
            const overflow = currentScroll - resetPoint;
            // 重置位置，但保留超出的距離，確保平滑
            scrollY = overflow;
            inner.style.transform = `translateY(-${overflow}px)`;
        } else {
            inner.style.transform = `translateY(-${currentScroll}px)`;
        }

        requestAnimationFrame(animate);
    }
    requestAnimationFrame(animate);
}

// 格式化金額顯示
function formatAmount(amount) {
    return new Intl.NumberFormat('zh-TW', {
        style: 'currency',
        currency: 'TWD',
    }).format(amount);
}

function getCustomTierClass(amount) {
    if (amount >= 1500) return 7;
    if (amount >= 750) return 6;
    if (amount >= 300) return 5;
    if (amount >= 150) return 4;
    if (amount >= 75) return 3;
    if (amount >= 30) return 2;
    if (amount >= 15) return 1;
    return 1;
}

// 只有在 DOMContentLoaded 時初始化一次
document.addEventListener('DOMContentLoaded', initializeApp, { once: true });

// 如果有其他事件監聽器，確保它們也只註冊一次
function initializeEventListeners() {
    const settingsBtn = document.getElementById('settingsBtn');
    if (settingsBtn) {
        // 移除舊的事件監聽器（如果有的話）
        settingsBtn.replaceWith(settingsBtn.cloneNode(true));
        const newSettingsBtn = document.getElementById('settingsBtn');
        newSettingsBtn.addEventListener('click', () => {
            const merchantId = sessionStorage.getItem('merchantId');
            if (merchantId) {
                window.location.href = `/ecpay-setting.html`;
            }
        });
    }
}
