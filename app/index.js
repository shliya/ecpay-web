// app/index.js
// 使用一個標記來防止重複初始化
let isInitialized = false;

// 在檔案最上方引入 CSS
import './css/common.css';
import './css/list.css';

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
        // 確保使用正確的 URL 格式
        const checkResponse = await fetch(
            `/api/v1/comme/ecpay/check-merchant/id=${merchantId}`
        );
        const checkResult = await checkResponse.json();
        // 載入斗內資料
        await loadDonations(merchantId);

        // 設定定時更新（使用 let 以便可以清除）
        let updateInterval = setInterval(
            () => loadDonations(merchantId),
            30000
        );

        // 在頁面離開時清除 interval
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

        let total = 0;
        donationList.innerHTML = '';

        const showCount = 5;
        const showDonations = donations.slice(0, showCount);

        showDonations.forEach(donation => {
            const amount = parseInt(donation.cost) || 0;
            total += amount;
            const message = donation.message || '';

            // 取得金額區間 class 編號
            const tier = getCustomTierClass(amount);

            // 外層卡片
            const card = document.createElement('div');
            card.className = 'custom-donation-card';

            // 上方 header（ID + 金額）
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

            // 下方留言
            const messageDiv = document.createElement('div');
            messageDiv.className = `custom-donation-message custom-tier-message-${tier}`;
            messageDiv.textContent = message ? `留言內容${message}` : '';

            card.appendChild(header);
            card.appendChild(messageDiv);
            donationList.appendChild(card);
        });
    } catch (error) {
        console.error('更新畫面失敗:', error);
    }
}

function getSuperchatTitle(donation) {
    // 依據 donation.type 給標題
    if (donation.type === 'member') {
        return '歡迎加入會員！';
    } else if (donation.type === 'gift') {
        return `贈送 ${donation.giftCount || ''} 份會員`;
    } else if (donation.type === 'renew') {
        return `會員 ${donation.months || 1} 個月`;
    } else if (donation.type === 'superchat') {
        return '';
    }
    return '';
}

function getSuperchatTierClass(type, amount) {
    if (amount >= 750) return 'superchat-tier-red';
    if (amount >= 300) return 'superchat-tier-orange';
    if (amount >= 150) return 'superchat-tier-yellow';
    if (amount >= 75) return 'superchat-tier-green';
    if (amount >= 30) return 'superchat-tier-blue';
    else return 'superchat-tier-blue';
}

// 格式化金額顯示
function formatAmount(amount) {
    return new Intl.NumberFormat('zh-TW', {
        style: 'currency',
        currency: 'TWD',
    }).format(amount);
}

function getCustomTierClass(amount) {
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
