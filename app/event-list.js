// app/event-list.js
// 使用一個標記來防止重複初始化
let isInitialized = false;

// 在檔案最上方引入 CSS
import './css/common.css';
import './css/event-list.css';

// 儲存事件列表狀態
let eventListState = {
    events: [],
    isLoading: false,
    merchantId: null,
};

async function initializeEventList() {
    if (isInitialized) {
        console.log('Event list already initialized');
        return;
    }

    function getQueryParam(name) {
        const url = new URL(window.location.href);
        return url.searchParams.get(name);
    }

    isInitialized = true;
    console.log('Initializing event list...');

    const urlMerchantId = getQueryParam('merchantId');
    const merchantId = urlMerchantId || localStorage.getItem('merchantId');

    if (merchantId === 'null' || merchantId === null) {
        console.error('No merchant ID found');
        showError('找不到商戶 ID，請重新登入');
        return;
    }

    eventListState.merchantId = merchantId;

    // 綁定事件監聽器
    bindEventListeners();

    try {
        await loadEventList(merchantId);
    } catch (error) {
        console.error('初始化失敗:', error);
        showError('初始化失敗，請重新整理頁面');
    }
}

function bindEventListeners() {
    const homeBtn = document.getElementById('homeBtn');
    const refreshBtn = document.getElementById('refreshBtn');
    const createBtn = document.getElementById('createBtn');
    const closeModal = document.getElementById('closeModal');
    const cancelBtn = document.getElementById('cancelBtn');
    const createForm = document.getElementById('createEventForm');

    if (homeBtn) {
        homeBtn.addEventListener('click', handleGoHome);
    }

    if (refreshBtn) {
        refreshBtn.addEventListener('click', handleRefresh);
    }

    if (createBtn) {
        createBtn.addEventListener('click', handleShowCreateModal);
    }

    if (closeModal) {
        closeModal.addEventListener('click', handleHideCreateModal);
    }

    if (cancelBtn) {
        cancelBtn.addEventListener('click', handleHideCreateModal);
    }

    if (createForm) {
        createForm.addEventListener('submit', handleCreateEvent);
    }

    const modal = document.getElementById('createModal');
    if (modal) {
        modal.addEventListener('click', e => {
            if (e.target === modal) {
                handleHideCreateModal();
            }
        });
    }
}

async function loadEventList(merchantId) {
    if (eventListState.isLoading) return;

    eventListState.isLoading = true;
    showLoading(true);
    hideError();

    try {
        console.log(`Loading events for merchant ${merchantId}...`);
        const response = await fetch(
            `/api/v1/fundraising-events/merchantId=${merchantId}`
        );

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const events = await response.json();
        eventListState.events = Array.isArray(events) ? events : [];

        renderEventList(eventListState.events);
    } catch (error) {
        console.error('載入斗內活動列表失敗:', error);
        showError('載入斗內活動列表失敗，請稍後再試');
    } finally {
        eventListState.isLoading = false;
        showLoading(false);
    }
}

function renderEventList(events) {
    const eventListContainer = document.getElementById('eventList');

    if (!eventListContainer) {
        console.error('Event list container not found');
        return;
    }

    if (!events || events.length === 0) {
        eventListContainer.innerHTML = `
            <div class="empty-state">
                <p>目前沒有斗內活動</p>
            </div>
        `;
        return;
    }

    const eventListHTML = events.map(event => createEventCard(event)).join('');
    eventListContainer.innerHTML = eventListHTML;

    // 綁定按鈕事件
    bindEventCardListeners();
}

// 建立事件卡片
function createEventCard(event) {
    const totalAmount = parseInt(event.totalAmount) || 0;
    const currentCost = parseInt(event.cost) || 0;
    const eventType = parseInt(event.type) || 1;

    let currentHealth, healthPercentage;

    if (eventType === 1) {
        currentHealth = Math.max(0, totalAmount - currentCost);
        healthPercentage =
            totalAmount > 0 ? (currentHealth / totalAmount) * 100 : 0;
    } else {
        currentHealth = Math.min(currentCost, totalAmount);
        healthPercentage =
            totalAmount > 0 ? (currentHealth / totalAmount) * 100 : 0;
    }

    const statusText = event.status === 1 ? '進行中' : '已結束';
    const statusClass = event.status === 1 ? 'active' : 'inactive';
    const typeText = eventType === 1 ? '倒扣模式' : '累積模式';

    return `
        <div class="event-card" data-event-id="${event.id}">
            <div class="event-header">
                <h3 class="event-name">${escapeHtml(event.eventName)}</h3>
                <div class="event-status ${statusClass}">${statusText}</div>
            </div>
            
            <div class="event-info">
                <div class="event-type">${typeText}</div>
                <div class="event-dates">
                    <span>開始：${formatDate(event.startMonth)}</span>
                    <span>結束：${formatDate(event.endMonth)}</span>
                </div>
            </div>
            
            <div class="event-progress">
                <div class="progress-bar">
                    <div class="progress-fill" style="width: ${healthPercentage}%"></div>
                </div>
                <div class="progress-text">
                    ${currentHealth.toLocaleString()} / ${totalAmount.toLocaleString()}
                    (${healthPercentage.toFixed(1)}%)
                </div>
            </div>
            
            ${event.description ? `<div class="event-description">${escapeHtml(event.description)}</div>` : ''}
            
            <div class="event-actions">
                <button class="btn btn-primary view-event-btn" 
                        data-merchant-id="${event.merchantId}" 
                        data-event-id="${event.id}">
                    查看
                </button>
                ${
                    event.status === 1
                        ? `
    <button class="btn btn-danger disable-event-btn" 
            data-merchant-id="${event.merchantId}" 
            data-event-id="${event.id}">
        關閉
    </button>
    `
                        : `
    <button class="btn btn-secondary enable-event-btn" 
            data-merchant-id="${event.merchantId}" 
            data-event-id="${event.id}">
        開啟
    </button>
    <button class="btn btn-secondary" disabled>
        已關閉
    </button>
    `
                }
            </div>
        </div>
    `;
}

// 綁定事件卡片按鈕監聽器
function bindEventCardListeners() {
    const viewEventBtns = document.querySelectorAll('.view-event-btn');
    const disableEventBtns = document.querySelectorAll('.disable-event-btn');
    const enableEventBtns = document.querySelectorAll('.enable-event-btn');
    viewEventBtns.forEach(btn => {
        btn.addEventListener('click', handleViewEvent);
    });
    disableEventBtns.forEach(btn => {
        btn.addEventListener('click', handleDisableEvent);
    });
    enableEventBtns.forEach(btn => {
        btn.addEventListener('click', handleEnableEvent);
    });
}

// 處理查看事件
function handleViewEvent(event) {
    const merchantId = event.target.getAttribute('data-merchant-id');
    const eventId = event.target.getAttribute('data-event-id');

    if (merchantId && eventId) {
        const eventUrl = `event.html?merchantId=${encodeURIComponent(merchantId)}&id=${encodeURIComponent(eventId)}`;
        window.open(eventUrl, '_blank');
    }
}

// 處理回首頁
function handleGoHome() {
    if (!eventListState.merchantId) {
        console.warn('No merchant ID found, redirecting to login');
        window.location.href = 'login.html';
        return;
    }

    console.log(
        'Navigating to home with merchantId:',
        eventListState.merchantId
    );
    const homeUrl = `index.html?merchantId=${encodeURIComponent(eventListState.merchantId)}`;
    window.location.href = homeUrl;
}

// 處理重新整理
async function handleRefresh() {
    if (eventListState.merchantId) {
        await loadEventList(eventListState.merchantId);
    }
}

// 顯示新增活動彈出視窗
function handleShowCreateModal() {
    const modal = document.getElementById('createModal');
    const form = document.getElementById('createEventForm');

    if (modal && form) {
        form.reset();

        const today = new Date();
        const nextMonth = new Date(
            today.getFullYear(),
            today.getMonth() + 1,
            today.getDate()
        );

        document.getElementById('startMonth').value = formatDateForInput(today);
        document.getElementById('endMonth').value =
            formatDateForInput(nextMonth);
        document.getElementById('totalAmount').value = '1500';

        modal.style.display = 'block';

        setTimeout(() => {
            document.getElementById('eventName').focus();
        }, 100);
    }
}

// 隱藏新增活動彈出視窗
function handleHideCreateModal() {
    const modal = document.getElementById('createModal');
    if (modal) {
        modal.style.display = 'none';
    }
}

// 處理新增活動
async function handleCreateEvent(event) {
    event.preventDefault();

    if (eventListState.isLoading) return;

    const form = event.target;
    const formData = new FormData(form);

    const eventData = {
        merchantId: eventListState.merchantId,
        eventName: formData.get('eventName').trim(),
        type: parseInt(formData.get('type')),
        startMonth: formData.get('startMonth'),
        endMonth: formData.get('endMonth'),
        totalAmount: parseInt(formData.get('totalAmount')),
    };

    // 如果有描述就加入
    const description = formData.get('description').trim();
    if (description) {
        eventData.description = description;
    }

    // 驗證資料
    if (!validateEventData(eventData)) {
        return;
    }

    try {
        eventListState.isLoading = true;
        const submitBtn = document.getElementById('submitBtn');
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.textContent = '建立中...';
        }

        console.log('Creating event:', eventData);
        const response = await fetch('/api/v1/fundraising-events', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(eventData),
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(
                errorData.message || `HTTP error! status: ${response.status}`
            );
        }

        const result = await response.json();
        console.log('Event created successfully:', result);

        // 關閉彈出視窗
        handleHideCreateModal();

        // 重新載入列表
        await loadEventList(eventListState.merchantId);

        showSuccess('活動建立成功！');
    } catch (error) {
        console.error('建立活動失敗:', error);
        showError(`建立活動失敗：${error.message}`);
    } finally {
        eventListState.isLoading = false;
        const submitBtn = document.getElementById('submitBtn');
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.textContent = '建立活動';
        }
    }
}

// 驗證活動資料
function validateEventData(eventData) {
    if (!eventData.eventName) {
        showError('請輸入活動名稱');
        return false;
    }

    if (eventData.eventName.length > 100) {
        showError('活動名稱不能超過 100 個字元');
        return false;
    }

    if (!eventData.totalAmount || eventData.totalAmount < 1) {
        showError('目標金額必須大於 0');
        return false;
    }

    if (!eventData.startMonth || !eventData.endMonth) {
        showError('請選擇開始和結束日期');
        return false;
    }

    const startDate = new Date(eventData.startMonth);
    const endDate = new Date(eventData.endMonth);

    if (endDate <= startDate) {
        showError('結束日期必須晚於開始日期');
        return false;
    }

    return true;
}

// 顯示載入狀態
function showLoading(show) {
    const loading = document.getElementById('loading');
    if (loading) {
        loading.style.display = show ? 'block' : 'none';
    }
}

// 顯示錯誤訊息
function showError(message) {
    const errorElement = document.getElementById('errorMessage');
    if (errorElement) {
        errorElement.textContent = message;
        errorElement.style.display = 'block';
    }
}

// 隱藏錯誤訊息
function hideError() {
    const errorElement = document.getElementById('errorMessage');
    if (errorElement) {
        errorElement.style.display = 'none';
    }
}

// 顯示成功訊息
function showSuccess(message) {
    const errorElement = document.getElementById('errorMessage');
    if (errorElement) {
        errorElement.textContent = message;
        errorElement.style.display = 'block';
        errorElement.style.backgroundColor = '#e8f5e8';
        errorElement.style.color = '#2e7d32';
        errorElement.style.borderLeftColor = '#4caf50';

        setTimeout(() => {
            hideError();
            errorElement.style.backgroundColor = '#ffebee';
            errorElement.style.color = '#c62828';
            errorElement.style.borderLeftColor = '#c62828';
        }, 3000);
    }
}

function formatDate(dateString) {
    if (!dateString) return '未設定';

    try {
        const date = new Date(dateString);
        return date.toLocaleDateString('zh-TW', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
        });
    } catch (error) {
        return '日期格式錯誤';
    }
}

function formatDateForInput(date) {
    if (!date) return '';

    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');

    return `${year}-${month}-${day}`;
}

// HTML 轉義
function escapeHtml(text) {
    if (!text) return '';

    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;',
    };

    return text.replace(/[&<>"']/g, m => map[m]);
}

async function handleDisableEvent(event) {
    const merchantId = event.target.getAttribute('data-merchant-id');
    const eventId = event.target.getAttribute('data-event-id');

    if (!merchantId || !eventId) return;

    const button = event.target;
    const originalText = button.textContent;

    try {
        button.disabled = true;
        button.textContent = '關閉中...';

        console.log(`Disabling event: ${eventId} for merchant: ${merchantId}`);

        const response = await fetch(
            `/api/v1/fundraising-events/id=${encodeURIComponent(eventId)}/merchantId=${encodeURIComponent(merchantId)}/status`,
            {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    status: 0, // 設定為關閉狀態
                }),
            }
        );

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(
                errorData.message || `HTTP error! status: ${response.status}`
            );
        }

        // 重新載入列表
        await loadEventList(eventListState.merchantId);

        showSuccess('活動已成功關閉！');
    } catch (error) {
        console.error('關閉活動失敗:', error);
        showError(`關閉活動失敗：${error.message}`);

        // 恢復按鈕狀態
        button.disabled = false;
        button.textContent = originalText;
    }
}

async function handleEnableEvent(event) {
    const merchantId = event.target.getAttribute('data-merchant-id');
    const eventId = event.target.getAttribute('data-event-id');

    if (!merchantId || !eventId) return;

    const button = event.target;
    const originalText = button.textContent;

    try {
        button.disabled = true;
        button.textContent = '開啟中...';

        console.log(`Enabling event: ${eventId} for merchant: ${merchantId}`);

        const response = await fetch(
            `/api/v1/fundraising-events/id=${encodeURIComponent(eventId)}/merchantId=${encodeURIComponent(merchantId)}/status/enable`,
            {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    status: 0, // 設定為關閉狀態
                }),
            }
        );

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(
                errorData.message || `HTTP error! status: ${response.status}`
            );
        }

        // 重新載入列表
        await loadEventList(eventListState.merchantId);

        showSuccess('活動已成功關閉！');
    } catch (error) {
        console.error('關閉活動失敗:', error);
        showError(`關閉活動失敗：${error.message}`);

        // 恢復按鈕狀態
        button.disabled = false;
        button.textContent = originalText;
    }
}

// 只有在 DOMContentLoaded 時初始化一次
document.addEventListener('DOMContentLoaded', initializeEventList, {
    once: true,
});
