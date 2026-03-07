// app/donate-list.js
// 使用一個標記來防止重複初始化
let isInitialized = false;

// 在檔案最上方引入 CSS
import './css/common.css';
import './css/list.css';
import ActiveStatusKeeper from './js/active-keeper.js';

// 儲存動畫狀態
let donationScrollState = {
    inner: null,
    cardCount: 0,
    animationStarted: false,
    lastData: [],
};

async function initializeApp() {
    if (isInitialized) return;

    function getQueryParam(name) {
        const url = new URL(window.location.href);
        return url.searchParams.get(name);
    }

    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', () => {
            localStorage.removeItem('merchantId');
            window.location.href = '/login.html';
        });
    }

    isInitialized = true;
    const urlId = getQueryParam('id');
    const urlMerchantId = getQueryParam('merchantId');
    const merchantId = urlMerchantId || localStorage.getItem('merchantId');

    if (!merchantId || merchantId === 'null') {
        window.location.href = '/login.html';
        return;
    }

    try {
        const checkResponse = await fetch(
            `/api/v1/comme/ecpay/check-merchant/id=${merchantId}`
        );
        const checkResult = await checkResponse.json();
        await loadDonations(merchantId);

        const activeKeeper = new ActiveStatusKeeper(merchantId, 3001);
        activeKeeper.connect();

        window.addEventListener('beforeunload', () => {
            activeKeeper.disconnect();
        });

        let updateInterval = setInterval(
            () => loadDonations(merchantId),
            10000
        );

        window.addEventListener('beforeunload', () => {
            if (updateInterval) clearInterval(updateInterval);
        });
    } catch (error) {
        console.error('初始化失敗:', error);
    }
}

async function loadDonations(merchantId) {
    try {
        const response = await fetch(
            `/api/v1/comme/ecpay/donations/id=${merchantId}`
        );
        const donations = await response.json();
        updateDonationList(donations);
    } catch (error) {
        console.error('載入斗內資料失敗:', error);
    }
}

function updateDonationList(donations) {
    try {
        const donationList = document.getElementById('donationList');
        if (!donationList) return;

        let inner = donationScrollState.inner;
        const needRebuild =
            !inner || inner.children.length !== donations.length;

        if (needRebuild) {
            donationList.innerHTML = '';
            inner = document.createElement('div');
            inner.className = 'donation-list-inner';

            donations.forEach(donation => {
                inner.appendChild(createDonationCard(donation));
            });

            donationList.appendChild(inner);
            donationScrollState.inner = inner;
            donationScrollState.cardCount = donations.length;
            donationScrollState.lastData = donations;
        } else {
            for (let i = 0; i < donations.length; i++) {
                updateDonationCard(inner.children[i], donations[i]);
            }
            donationScrollState.lastData = donations;
        }
    } catch (error) {
        console.error('更新畫面失敗:', error);
    }
}

function formatDate(dateString) {
    if (!dateString) return '';
    const date = new Date(dateString);
    const taiwanDate = new Date(date.getTime() + 8 * 60 * 60 * 1000);

    const year = taiwanDate.getUTCFullYear();
    const month = String(taiwanDate.getUTCMonth() + 1).padStart(2, '0');
    const day = String(taiwanDate.getUTCDate()).padStart(2, '0');
    const hours = String(taiwanDate.getUTCHours()).padStart(2, '0');
    const minutes = String(taiwanDate.getUTCMinutes()).padStart(2, '0');

    return `${year}-${month}-${day} ${hours}:${minutes}`;
}

// 建立卡片元素
function createDonationCard(donation) {
    const amount = parseInt(donation.cost) || 0;
    const message = donation.message || '';
    const tier = getCustomTierClass(amount);
    const createdAt = formatDate(donation.created_at || '');

    const card = document.createElement('div');
    card.className = `custom-donation-card tier-${tier}`;
    if (tier === 7) card.classList.add('tier-7-drop');

    // 建立上半部 Header (窄寶箱)
    const header = document.createElement('div');
    header.className = 'custom-donation-header';

    const idSpan = document.createElement('span');
    idSpan.className = 'custom-donation-id';
    idSpan.textContent = donation.name ? donation.name : 'ID匿名';

    const amountSpan = document.createElement('span');
    amountSpan.className = 'custom-donation-amount';
    amountSpan.textContent = formatAmount(amount);

    header.appendChild(idSpan);
    header.appendChild(amountSpan);

    // 建立下半部 Message (寬寶箱)
    const messageDiv = document.createElement('div');
    messageDiv.className = 'custom-donation-message';

    const messageContent = document.createElement('div');
    messageContent.className = 'message-content';
    messageContent.textContent = message;

    const timeSpan = document.createElement('div');
    timeSpan.className = 'custom-donation-time';
    timeSpan.textContent = createdAt;

    messageDiv.appendChild(messageContent);
    messageDiv.appendChild(timeSpan);

    card.appendChild(header);
    card.appendChild(messageDiv);

    return card;
}

// 更新現有卡片元素
function updateDonationCard(card, donation) {
    const amount = parseInt(donation.cost) || 0;
    const message = donation.message || '';
    const tier = getCustomTierClass(amount);
    const createdAt = formatDate(donation.created_at || '');

    // 更新外層 class 控制顏色
    card.className = `custom-donation-card tier-${tier}`;
    if (tier === 7) card.classList.add('tier-7-drop');

    const idEl = card.querySelector('.custom-donation-id');
    if (idEl) idEl.textContent = donation.name ? donation.name : 'ID匿名';

    const amountEl = card.querySelector('.custom-donation-amount');
    if (amountEl) amountEl.textContent = formatAmount(amount);

    const messageEl = card.querySelector('.message-content');
    if (messageEl) messageEl.textContent = message;

    const timeEl = card.querySelector('.custom-donation-time');
    if (timeEl) timeEl.textContent = createdAt;
}

function formatAmount(amount) {
    return new Intl.NumberFormat('zh-TW', {
        style: 'currency',
        currency: 'TWD',
        minimumFractionDigits: 0,
    }).format(amount);
}

function getCustomTierClass(amount) {
    if (amount >= 1500) return 7;
    if (amount >= 750) return 6;
    if (amount >= 300) return 5;
    if (amount >= 150) return 4;
    if (amount >= 75) return 3;
    if (amount >= 30) return 2;
    return 1;
}

document.addEventListener('DOMContentLoaded', initializeApp, { once: true });
