// app/event-list.js
// 使用一個標記來防止重複初始化
let isInitialized = false;

// 在檔案最上方引入 CSS
import './css/common.css';
import './css/event-list.css';
import ActiveStatusKeeper from './js/active-keeper.js';
import checkTotpBinding from './js/totp-guard.js';

// 儲存事件列表狀態
let eventListState = {
    events: [],
    isLoading: false,
    merchantId: null,
    editingEvent: null,
};

const DONATION_TYPE = {
    ECPAY: 1,
    YOUTUBE_SUPER_CHAT: 2,
    PAYUNI: 3,
};

function formatDonationTypeLabel(type) {
    const n = Number(type);
    if (n === DONATION_TYPE.YOUTUBE_SUPER_CHAT) return 'YouTube';
    if (n === DONATION_TYPE.PAYUNI) return 'PAYUNi';
    if (n === DONATION_TYPE.ECPAY) return '綠界';
    return '—';
}

/** 台灣時間 YYYY-MM-DD HH:mm（與 donate-list 時區邏輯一致） */
function formatDonationDateTime(isoString) {
    if (!isoString) return '—';
    const date = new Date(isoString);
    if (Number.isNaN(date.getTime())) return '—';
    const taiwan = new Date(date.getTime() + 8 * 60 * 60 * 1000);
    const y = taiwan.getUTCFullYear();
    const m = String(taiwan.getUTCMonth() + 1).padStart(2, '0');
    const day = String(taiwan.getUTCDate()).padStart(2, '0');
    const h = String(taiwan.getUTCHours()).padStart(2, '0');
    const min = String(taiwan.getUTCMinutes()).padStart(2, '0');
    return `${y}-${m}-${day} ${h}:${min}`;
}

function handleDonationsDrawerEscape(e) {
    if (e.key === 'Escape') {
        closeDonationsDrawer();
    }
}

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

    const totpOk = await checkTotpBinding(merchantId);
    if (!totpOk) return;

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
    const closeEditTitleModal = document.getElementById('closeEditTitleModal');
    const cancelEditTitleBtn = document.getElementById('cancelEditTitleBtn');
    const editTitleForm = document.getElementById('editTitleForm');

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

    if (closeEditTitleModal) {
        closeEditTitleModal.addEventListener('click', handleHideEditTitleModal);
    }

    if (cancelEditTitleBtn) {
        cancelEditTitleBtn.addEventListener('click', handleHideEditTitleModal);
    }

    if (editTitleForm) {
        editTitleForm.addEventListener('submit', handleEditTitle);
    }

    const editTitleModal = document.getElementById('editTitleModal');
    if (editTitleModal) {
        editTitleModal.addEventListener('click', e => {
            if (e.target === editTitleModal) {
                handleHideEditTitleModal();
            }
        });
    }

    bindDonationsDrawer();
}

function bindDonationsDrawer() {
    const overlay = document.getElementById('donationsDrawer');
    const closeBtn = document.getElementById('donationsDrawerClose');
    if (overlay && closeBtn) {
        closeBtn.addEventListener('click', () => {
            closeDonationsDrawer();
        });
        overlay.addEventListener('click', e => {
            if (e.target === overlay) {
                closeDonationsDrawer();
            }
        });
    }
}

function openDonationsDrawer() {
    const overlay = document.getElementById('donationsDrawer');
    if (!overlay) return;
    overlay.classList.add('donations-drawer-overlay--open');
    overlay.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', handleDonationsDrawerEscape);
    closeBtnFocus();
}

function closeBtnFocus() {
    const closeBtn = document.getElementById('donationsDrawerClose');
    if (closeBtn) {
        closeBtn.focus();
    }
}

function closeDonationsDrawer() {
    const overlay = document.getElementById('donationsDrawer');
    if (!overlay) return;
    overlay.classList.remove('donations-drawer-overlay--open');
    overlay.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
    document.removeEventListener('keydown', handleDonationsDrawerEscape);
}

async function loadDonationsIntoDrawer(merchantId, startDate, endDate) {
    const loading = document.getElementById('donationsDrawerLoading');
    const errorEl = document.getElementById('donationsDrawerError');
    const emptyEl = document.getElementById('donationsDrawerEmpty');
    const tableWrap = document.getElementById('donationsDrawerTableWrap');
    const tbody = document.getElementById('donationsDrawerRows');
    const rangeEl = document.getElementById('donationsDrawerRange');

    if (rangeEl) {
        rangeEl.textContent = `期間：${startDate} ～ ${endDate}（商店 ${merchantId}）`;
    }
    if (loading) loading.style.display = 'block';
    if (errorEl) {
        errorEl.style.display = 'none';
        errorEl.textContent = '';
    }
    if (emptyEl) emptyEl.style.display = 'none';
    if (tableWrap) tableWrap.style.display = 'none';
    if (tbody) tbody.innerHTML = '';

    const path =
        `/api/v1/comme/ecpay/donations` +
        `/startDate=${encodeURIComponent(startDate)}` +
        `/endDate=${encodeURIComponent(endDate)}` +
        `/id=${encodeURIComponent(merchantId)}`;

    try {
        const response = await fetch(path);
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        const donations = await response.json();
        const list = Array.isArray(donations) ? donations : [];

        if (loading) loading.style.display = 'none';

        if (list.length === 0) {
            if (emptyEl) emptyEl.style.display = 'flex';
            return;
        }

        if (tbody) {
            tbody.innerHTML = list
                .map(d => {
                    const name = escapeHtml(d.name || '');
                    const cost = Number(d.cost) || 0;
                    const msg = escapeHtml(d.message || '');
                    const typeLabel = escapeHtml(
                        formatDonationTypeLabel(d.type)
                    );
                    const dt = escapeHtml(
                        formatDonationDateTime(d.created_at || d.createdAt)
                    );
                    return `<tr>
                        <td>${name || '—'}</td>
                        <td class="col-amount">${cost.toLocaleString()}</td>
                        <td class="col-message">${msg || '—'}</td>
                        <td>${typeLabel}</td>
                        <td class="col-datetime">${dt}</td>
                    </tr>`;
                })
                .join('');
        }
        if (tableWrap) tableWrap.style.display = 'block';
    } catch (err) {
        console.error(err);
        if (loading) loading.style.display = 'none';
        if (errorEl) {
            errorEl.textContent = '載入斗內紀錄失敗，請稍後再試';
            errorEl.style.display = 'block';
        }
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

    const statusText =
        event.status === 1
            ? '進行中'
            : event.status === 2
              ? '已暫停'
              : '已結束';
    const statusClass =
        event.status === 1
            ? 'active'
            : event.status === 2
              ? 'pause'
              : 'inactive';
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
                <button class="btn btn-secondary view-donations-btn" 
                        type="button"
                        data-merchant-id="${escapeHtml(String(event.merchantId || ''))}" 
                        data-start-date="${escapeHtml(toDateOnlyParam(event.startMonth))}"
                        data-end-date="${escapeHtml(toDateOnlyParam(event.endMonth))}">
                    查看斗內
                </button>
                <button class="btn btn-secondary edit-title-btn" 
                        data-merchant-id="${event.merchantId}" 
                        data-event-id="${event.id}"
                        data-event-name="${escapeHtml(event.eventName)}">
                    編輯標題
                </button>
                ${
                    event.status === 1
                        ? `
    <button class="btn btn-warning pause-event-btn" 
            data-merchant-id="${event.merchantId}" 
            data-event-id="${event.id}">
        暫停活動
    </button>
    <button class="btn btn-danger disable-event-btn" 
            data-merchant-id="${event.merchantId}" 
            data-event-id="${event.id}">
        關閉活動
    </button>
    `
                        : event.status === 2
                          ? `
    <button class="btn btn-success resume-event-btn" 
            data-merchant-id="${event.merchantId}" 
            data-event-id="${event.id}">
        恢復活動
    </button>
    <button class="btn btn-danger disable-event-btn" 
            data-merchant-id="${event.merchantId}" 
            data-event-id="${event.id}">
        關閉活動
    </button>
    `
                          : `
    <button class="btn btn-secondary enable-event-btn" 
            data-merchant-id="${event.merchantId}" 
            data-event-id="${event.id}">
        開啟活動
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
    const pauseEventBtns = document.querySelectorAll('.pause-event-btn');
    const resumeEventBtns = document.querySelectorAll('.resume-event-btn');
    const editTitleBtns = document.querySelectorAll('.edit-title-btn');
    const viewDonationsBtns = document.querySelectorAll('.view-donations-btn');

    viewEventBtns.forEach(btn => {
        btn.addEventListener('click', handleViewEvent);
    });
    viewDonationsBtns.forEach(btn => {
        btn.addEventListener('click', handleViewDonations);
    });
    disableEventBtns.forEach(btn => {
        btn.addEventListener('click', handleDisableEvent);
    });
    enableEventBtns.forEach(btn => {
        btn.addEventListener('click', handleEnableEvent);
    });
    pauseEventBtns.forEach(btn => {
        btn.addEventListener('click', handlePauseEvent);
    });
    resumeEventBtns.forEach(btn => {
        btn.addEventListener('click', handleResumeEvent);
    });
    editTitleBtns.forEach(btn => {
        btn.addEventListener('click', handleShowEditTitleModal);
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

async function handleViewDonations(clickEvent) {
    const btn = clickEvent.currentTarget;
    const merchantId = btn.getAttribute('data-merchant-id');
    const startDate = btn.getAttribute('data-start-date');
    const endDate = btn.getAttribute('data-end-date');
    if (!merchantId || !startDate || !endDate) {
        return;
    }
    openDonationsDrawer();
    await loadDonationsIntoDrawer(merchantId, startDate, endDate);
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

/** 活動起迄轉成 YYYY-MM-DD，供「查看斗內」查詢 API */
function toDateOnlyParam(value) {
    if (value == null || value === '') return '';
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return '';
    return d.toISOString().slice(0, 10);
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
                    status: 1, // 設定為啟動狀態
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

        showSuccess('活動已成功開啟！');
    } catch (error) {
        console.error('開啟活動失敗:', error);
        showError(`開啟活動失敗：${error.message}`);

        // 恢復按鈕狀態
        button.disabled = false;
        button.textContent = originalText;
    }
}

async function handlePauseEvent(event) {
    const merchantId = event.target.getAttribute('data-merchant-id');
    const eventId = event.target.getAttribute('data-event-id');

    if (!merchantId || !eventId) return;

    const button = event.target;
    const originalText = button.textContent;

    try {
        button.disabled = true;
        button.textContent = '暫停中...';

        console.log(`Pausing event: ${eventId} for merchant: ${merchantId}`);

        const response = await fetch(
            `/api/v1/fundraising-events/id=${encodeURIComponent(eventId)}/merchantId=${encodeURIComponent(merchantId)}/status/pause`,
            {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                },
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

        showSuccess('活動已成功暫停！');
    } catch (error) {
        console.error('暫停活動失敗:', error);
        showError(`暫停活動失敗：${error.message}`);

        // 恢復按鈕狀態
        button.disabled = false;
        button.textContent = originalText;
    }
}

async function handleResumeEvent(event) {
    const merchantId = event.target.getAttribute('data-merchant-id');
    const eventId = event.target.getAttribute('data-event-id');

    if (!merchantId || !eventId) return;

    const button = event.target;
    const originalText = button.textContent;

    try {
        button.disabled = true;
        button.textContent = '恢復中...';

        console.log(`Resuming event: ${eventId} for merchant: ${merchantId}`);

        const response = await fetch(
            `/api/v1/fundraising-events/id=${encodeURIComponent(eventId)}/merchantId=${encodeURIComponent(merchantId)}/status/enable`,
            {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    status: 1, // 設定為啟動狀態
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

        showSuccess('活動已成功恢復！');
    } catch (error) {
        console.error('恢復活動失敗:', error);
        showError(`恢復活動失敗：${error.message}`);

        // 恢復按鈕狀態
        button.disabled = false;
        button.textContent = originalText;
    }
}

// 顯示編輯標題彈出視窗
function handleShowEditTitleModal(event) {
    const merchantId = event.target.getAttribute('data-merchant-id');
    const eventId = event.target.getAttribute('data-event-id');
    const eventName = event.target.getAttribute('data-event-name');

    if (!merchantId || !eventId) return;

    eventListState.editingEvent = {
        merchantId,
        eventId,
        originalName: eventName,
    };

    const modal = document.getElementById('editTitleModal');
    const input = document.getElementById('editEventName');

    if (modal && input) {
        input.value = eventName || '';
        modal.style.display = 'block';

        setTimeout(() => {
            input.focus();
            input.select();
        }, 100);
    }
}

// 隱藏編輯標題彈出視窗
function handleHideEditTitleModal() {
    const modal = document.getElementById('editTitleModal');
    if (modal) {
        modal.style.display = 'none';
    }
    eventListState.editingEvent = null;
}

// 處理編輯標題
async function handleEditTitle(event) {
    event.preventDefault();

    if (!eventListState.editingEvent || eventListState.isLoading) return;

    const form = event.target;
    const formData = new FormData(form);
    const newEventName = formData.get('eventName').trim();

    // 驗證輸入
    if (!newEventName) {
        showError('請輸入活動名稱');
        return;
    }

    if (newEventName.length > 100) {
        showError('活動名稱不能超過 100 個字元');
        return;
    }

    if (newEventName === eventListState.editingEvent.originalName) {
        handleHideEditTitleModal();
        return;
    }

    const { merchantId, eventId } = eventListState.editingEvent;

    try {
        eventListState.isLoading = true;
        const submitBtn = document.getElementById('submitEditTitleBtn');
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.textContent = '修改中...';
        }

        console.log(
            `Updating event title: ${eventId} for merchant: ${merchantId}`
        );

        const response = await fetch(
            `/api/v1/fundraising-events/id=${encodeURIComponent(eventId)}/merchantId=${encodeURIComponent(merchantId)}`,
            {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    eventName: newEventName,
                }),
            }
        );

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(
                errorData.message || `HTTP error! status: ${response.status}`
            );
        }

        handleHideEditTitleModal();

        await loadEventList(eventListState.merchantId);

        showSuccess('活動標題修改成功！');

        setTimeout(() => {
            window.location.reload();
        }, 1500);
    } catch (error) {
        console.error('修改活動標題失敗:', error);
        showError(`修改活動標題失敗：${error.message}`);
    } finally {
        eventListState.isLoading = false;
        const submitBtn = document.getElementById('submitEditTitleBtn');
        if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.textContent = '確認修改';
        }
    }
}

// 只有在 DOMContentLoaded 時初始化一次
document.addEventListener('DOMContentLoaded', initializeEventList, {
    once: true,
});
