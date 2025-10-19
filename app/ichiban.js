// 引入CSS
import './css/ichiban.css';

class IchibanAdmin {
    constructor() {
        this.merchantId = null;
        this.ws = null;
        this.events = [];
        this.selectedEvent = null;
        this.isConnected = false;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;

        this.init();
    }

    init() {
        this.parseUrlParams();
        this.setupEventListeners();
        this.connectWebSocket();
        this.loadEvents();
    }

    parseUrlParams() {
        const urlParams = new URLSearchParams(window.location.search);
        this.merchantId = urlParams.get('merchantId');

        if (!this.merchantId) {
            this.showError('缺少必要的參數 (merchantId)');
            return;
        }
    }

    setupEventListeners() {
        document.getElementById('refreshBtn').addEventListener('click', () => {
            this.loadEvents();
        });

        // 新增活動按鈕
        document
            .getElementById('createEventBtn')
            .addEventListener('click', () => {
                this.showCreateEventModal();
            });
        // 模態框事件
        document.getElementById('closeModal').addEventListener('click', () => {
            this.closeConfirmModal();
        });

        document
            .getElementById('closeCardModal')
            .addEventListener('click', () => {
                this.closeCardDetailModal();
            });

        document
            .getElementById('closeCardDetailBtn')
            .addEventListener('click', () => {
                this.closeCardDetailModal();
            });

        document.getElementById('cancelBtn').addEventListener('click', () => {
            this.closeConfirmModal();
        });

        document.getElementById('confirmBtn').addEventListener('click', () => {
            this.executeConfirmedAction();
        });

        // 點擊背景關閉模態框
        document.getElementById('confirmModal').addEventListener('click', e => {
            if (e.target.id === 'confirmModal') {
                this.closeConfirmModal();
            }
        });

        document
            .getElementById('cardDetailModal')
            .addEventListener('click', e => {
                if (e.target.id === 'cardDetailModal') {
                    this.closeCardDetailModal();
                }
            });

        // 新增活動模態框事件
        document
            .getElementById('closeCreateModal')
            .addEventListener('click', () => {
                this.closeCreateEventModal();
            });

        document
            .getElementById('cancelCreateBtn')
            .addEventListener('click', () => {
                this.closeCreateEventModal();
            });

        document
            .getElementById('confirmCreateBtn')
            .addEventListener('click', () => {
                this.createEvent();
            });

        document.getElementById('addPrizeBtn').addEventListener('click', () => {
            this.addPrizeItem();
        });

        // 點擊背景關閉新增活動模態框
        document
            .getElementById('createEventModal')
            .addEventListener('click', e => {
                if (e.target.id === 'createEventModal') {
                    this.closeCreateEventModal();
                }
            });
    }

    connectWebSocket() {
        // 根據環境決定 WebSocket URL
        const isProduction = window.location.protocol === 'https:';
        const wsProtocol = isProduction ? 'wss:' : 'ws:';
        const wsHost = isProduction ? window.location.host : 'localhost:3001';
        const wsUrl = `${wsProtocol}//${wsHost}?merchantId=${this.merchantId}`;

        try {
            this.ws = new WebSocket(wsUrl);

            this.ws.onopen = () => {
                console.log('WebSocket 連接成功');
                this.isConnected = true;
                this.reconnectAttempts = 0;
                this.updateConnectionStatus(true);
            };

            this.ws.onmessage = event => {
                this.handleWebSocketMessage(JSON.parse(event.data));
            };

            this.ws.onclose = () => {
                console.log('WebSocket 連接關閉');
                this.isConnected = false;
                this.updateConnectionStatus(false);
                this.attemptReconnect();
            };

            this.ws.onerror = error => {
                console.error('WebSocket 錯誤:', error);
                this.isConnected = false;
                this.updateConnectionStatus(false);
            };
        } catch (error) {
            console.error('WebSocket 連接失敗:', error);
            this.updateConnectionStatus(false);
        }
    }

    attemptReconnect() {
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
            this.reconnectAttempts++;
            console.log(
                `嘗試重新連接 (${this.reconnectAttempts}/${this.maxReconnectAttempts})`
            );

            setTimeout(() => {
                this.connectWebSocket();
            }, 2000 * this.reconnectAttempts);
        } else {
            console.log('達到最大重連次數，停止重連');
        }
    }

    updateConnectionStatus(connected) {
        const statusIndicator = document.querySelector('.status-indicator');
        const statusText = document.querySelector('.status-text');

        if (statusIndicator && statusText) {
            if (connected) {
                statusIndicator.classList.add('connected');
                statusText.textContent = '已連線';
            } else {
                statusIndicator.classList.remove('connected');
                statusText.textContent = '連線中斷';
            }
        }
    }

    handleWebSocketMessage(message) {
        console.log('收到 WebSocket 訊息:', message);

        switch (message.type) {
            case 'connected':
                console.log('已連接到商戶房間');
                break;
            case 'card-locked':
                this.handleCardLocked(message);
                break;
            case 'card-locked-notification':
                this.handleCardLockedNotification(message);
                break;
            case 'card-opened':
                this.handleCardOpened(message);
                break;
            case 'card-opened-notification':
                this.handleCardOpenedNotification(message);
                break;
            case 'card-payment-failed':
                this.handleCardPaymentFailed(message);
                break;
            case 'card-payment-failed-notification':
                this.handleCardPaymentFailedNotification(message);
                break;
            case 'cards-reset':
                this.handleCardsReset(message);
                break;
            case 'cards-reset-notification':
                this.handleCardsResetNotification(message);
                break;
            case 'cards-locked':
                this.handleCardsLocked(message);
                break;
            case 'cards-locked-notification':
                this.handleCardsLockedNotification(message);
                break;
            case 'event-ended':
                this.handleEventEnded(message);
                break;
            case 'event-ended-notification':
                this.handleEventEndedNotification(message);
                break;
            case 'error':
                this.showError(message.message);
                break;
            case 'pong':
                // 心跳回應
                break;
            default:
                console.log('未知訊息類型:', message.type);
        }
    }

    handleCardLocked(message) {
        if (this.selectedEvent && this.selectedEvent.id === message.eventId) {
            this.updateCardStatus(message.cardIndex, 'locked');
            this.updateEventStats();
            this.addActivityRecord(
                `卡片 ${message.cardIndex + 1} 被鎖定 - ${message.prizeName}`
            );
        }
    }

    handleCardLockedNotification(message) {
        if (this.selectedEvent && this.selectedEvent.id === message.eventId) {
            this.updateCardStatus(message.cardIndex, 'locked');
            this.updateEventStats();
        }
        this.addActivityRecord(
            `卡片 ${message.cardIndex + 1} 被鎖定 - ${message.prizeName}`
        );
    }

    handleCardOpened(message) {
        if (this.selectedEvent && this.selectedEvent.id === message.eventId) {
            this.updateCardStatus(
                message.cardIndex,
                'opened',
                message.prizeName
            );
            this.updateEventStats();
            this.addActivityRecord(
                `卡片 ${message.cardIndex + 1} 已付款 - ${message.prizeName}`
            );
        }

        // 重新載入事件列表以更新統計
        this.loadEvents();
    }

    handleCardOpenedNotification(message) {
        if (this.selectedEvent && this.selectedEvent.id === message.eventId) {
            this.updateCardStatus(
                message.cardIndex,
                'opened',
                message.prizeName
            );
            this.updateEventStats();
        }
        this.addActivityRecord(
            `卡片 ${message.cardIndex + 1} 已付款 - ${message.prizeName}`
        );
    }

    handleCardsReset(message) {
        if (this.selectedEvent && this.selectedEvent.id === message.eventId) {
            this.loadEventDetails(this.selectedEvent.id);
            this.addActivityRecord('所有卡片已重置');
        }
    }

    handleCardsResetNotification(message) {
        this.addActivityRecord('所有卡片已重置');
    }

    handleCardsLocked(message) {
        if (this.selectedEvent && this.selectedEvent.id === message.eventId) {
            this.loadEventDetails(this.selectedEvent.id);
            this.addActivityRecord(`已鎖定 ${message.lockedCount} 張卡片`);
        }
    }

    handleCardsLockedNotification(message) {
        this.addActivityRecord(`已鎖定 ${message.lockedCount} 張卡片`);
    }

    handleCardPaymentFailed(message) {
        if (this.selectedEvent && this.selectedEvent.id === message.eventId) {
            this.updateCardStatus(message.cardIndex, 'closed');
            this.updateEventStats();

            const reason =
                message.reason === 'payment-timeout' ? '（付款超時）' : '';
            this.addActivityRecord(
                `卡片 ${message.cardIndex + 1} 付款失敗${reason}，已恢復為可點擊狀態`
            );
        }
    }

    handleCardPaymentFailedNotification(message) {
        if (this.selectedEvent && this.selectedEvent.id === message.eventId) {
            this.updateCardStatus(message.cardIndex, 'closed');
            this.updateEventStats();
        }

        const reason =
            message.reason === 'payment-timeout' ? '（付款超時）' : '';
        this.addActivityRecord(
            `卡片 ${message.cardIndex + 1} 付款失敗${reason}，已恢復為可點擊狀態`
        );
    }

    handleEventEnded(message) {
        if (this.selectedEvent && this.selectedEvent.id === message.eventId) {
            // 重新載入事件詳情以更新狀態
            this.loadEventDetails(this.selectedEvent.id);
        }
        this.addActivityRecord('活動已結束 - 所有卡片都已開啟');

        // 重新載入事件列表以更新狀態
        this.loadEvents();
    }

    handleEventEndedNotification(message) {
        this.addActivityRecord('活動已結束 - 所有卡片都已開啟');

        // 重新載入事件列表以更新狀態
        this.loadEvents();
    }

    async loadEvents() {
        try {
            const response = await fetch(
                `/api/v1/ichiban-events/merchantId=${this.merchantId}`
            );
            if (!response.ok) {
                throw new Error('載入活動列表失敗');
            }

            this.events = await response.json();
            this.renderEvents();
        } catch (error) {
            console.error('載入活動列表錯誤:', error);
            this.showError('載入活動列表失敗');
        }
    }

    renderEvents() {
        const container = document.getElementById('eventsGrid');

        // 清除loading訊息
        const loading = container.querySelector('.loading');
        if (loading) {
            loading.remove();
        }

        // 渲染現有活動
        container.innerHTML = '';
        this.events.forEach(event => {
            const eventCard = this.createEventCard(event);
            container.appendChild(eventCard);
        });
    }

    createEventCard(event) {
        const cardDiv = document.createElement('div');
        cardDiv.className = 'event-card';
        cardDiv.dataset.eventId = event.id;

        const openedCards = event.openedCards || 0;
        const totalCards = event.totalCards || 0;
        const completionRate =
            totalCards > 0 ? Math.round((openedCards / totalCards) * 100) : 0;

        cardDiv.innerHTML = `
            <div class="event-name">${event.eventName}</div>
            <div class="event-info">
                <div class="event-info-item">
                    <span class="event-info-label">價格:</span>
                    <span>$${event.cost}</span>
                </div>
                <div class="event-info-item">
                    <span class="event-info-label">總卡片:</span>
                    <span>${totalCards}</span>
                </div>
                <div class="event-info-item">
                    <span class="event-info-label">已開啟:</span>
                    <span>${openedCards}</span>
                </div>
                <div class="event-info-item">
                    <span class="event-info-label">完成度:</span>
                    <span>${completionRate}%</span>
                </div>
            </div>
            <div class="event-status ${this.getStatusClass(event.status)}">
                ${this.getStatusText(event.status)}
            </div>
            <div class="event-actions">
                <button class="btn btn-primary btn-sm" onclick="event.stopPropagation(); window.openClient('${event.id}')">
                    開啟客戶端
                </button>
            </div>
        `;

        cardDiv.addEventListener('click', () => {
            this.selectEvent(event);
        });

        return cardDiv;
    }

    getStatusText(status) {
        const statusMap = {
            1: '進行中',
            2: '已結束',
            3: '暫停',
        };
        return statusMap[status] || '未知';
    }

    getStatusClass(status) {
        const classMap = {
            1: 'active',
            2: 'ended',
            3: 'paused',
        };
        return classMap[status] || '';
    }

    async selectEvent(event) {
        // 更新選中狀態
        document.querySelectorAll('.event-card').forEach(card => {
            card.classList.remove('selected');
        });
        const selectedCard = document.querySelector(
            `[data-event-id="${event.id}"]`
        );
        if (selectedCard) {
            selectedCard.classList.add('selected');
        }

        this.selectedEvent = event;

        // 載入活動詳情
        await this.loadEventDetails(event.id);

        // 顯示詳情區域
        document.getElementById('eventDetails').style.display = 'block';
    }

    async loadEventDetails(eventId) {
        try {
            const response = await fetch(
                `/api/v1/ichiban-events/id=${eventId}/merchantId=${this.merchantId}`
            );
            if (!response.ok) {
                throw new Error('載入活動詳情失敗');
            }

            const eventData = await response.json();
            this.renderEventDetails(eventData);
        } catch (error) {
            console.error('載入活動詳情錯誤:', error);
            this.showError('載入活動詳情失敗');
        }
    }

    renderEventDetails(eventData) {
        document.getElementById('selectedEventName').textContent =
            eventData.eventName;

        const openedCards = eventData.openedCards || 0;
        const totalCards = eventData.totalCards || 0;
        const remainingCards = totalCards - openedCards;
        const completionRate =
            totalCards > 0 ? Math.round((openedCards / totalCards) * 100) : 0;

        document.getElementById('totalCards').textContent = totalCards;
        document.getElementById('openedCards').textContent = openedCards;
        document.getElementById('remainingCards').textContent = remainingCards;
        document.getElementById('completionRate').textContent =
            `${completionRate}%`;

        this.renderCards(eventData.cards || []);
    }

    renderCards(cards) {
        const container = document.getElementById('cardsGrid');

        if (!cards.length) {
            container.innerHTML = '<div class="loading">無卡片資料</div>';
            return;
        }

        container.innerHTML = '';

        cards.forEach((card, index) => {
            const cardElement = this.createCardElement(card, index);
            container.appendChild(cardElement);
        });
    }

    createCardElement(card, index) {
        const cardDiv = document.createElement('div');
        cardDiv.className = `admin-card ${this.getCardClass(card.status)}`;
        cardDiv.dataset.cardIndex = index;

        const cardNumber = document.createElement('div');
        cardNumber.className = 'card-number';
        cardNumber.textContent = index + 1;

        const cardPrize = document.createElement('div');
        cardPrize.className = 'card-prize';
        cardPrize.textContent = card.prize?.prizeName || '未知獎品';

        cardDiv.appendChild(cardNumber);
        cardDiv.appendChild(cardPrize);

        // 點擊查看詳情
        cardDiv.addEventListener('click', () => {
            this.showCardDetail(card, index);
        });

        return cardDiv;
    }

    getCardClass(status) {
        const classMap = {
            0: 'closed',
            1: 'locked',
            2: 'opened',
        };
        return classMap[status] || 'closed';
    }

    updateCardStatus(cardIndex, status, prizeName) {
        const cardElement = document.querySelector(
            `[data-card-index="${cardIndex}"]`
        );
        if (cardElement) {
            cardElement.className = `admin-card ${status}`;

            // 更新獎品名稱
            const prizeElement = cardElement.querySelector('.card-prize');
            if (prizeElement && prizeName) {
                prizeElement.textContent = prizeName;
            }
        }
    }

    updateEventStats() {
        if (!this.selectedEvent) return;

        const openedCards =
            document.querySelectorAll('.admin-card.opened').length;
        const totalCards = document.querySelectorAll('.admin-card').length;
        const remainingCards = totalCards - openedCards;
        const completionRate =
            totalCards > 0 ? Math.round((openedCards / totalCards) * 100) : 0;

        document.getElementById('openedCards').textContent = openedCards;
        document.getElementById('remainingCards').textContent = remainingCards;
        document.getElementById('completionRate').textContent =
            `${completionRate}%`;
    }

    showCardDetail(card, cardIndex) {
        document.getElementById('detailCardIndex').textContent = cardIndex + 1;
        document.getElementById('detailPrizeName').textContent =
            card.prize?.prizeName || '未知獎品';
        document.getElementById('detailStatus').textContent =
            this.getCardStatusText(card.status);
        document.getElementById('detailOpenedAt').textContent = card.openedAt
            ? new Date(card.openedAt).toLocaleString('zh-TW')
            : '未開啟';
        document.getElementById('detailOpenedBy').textContent =
            card.openedBy || '未開啟';

        const cardDetailModal = document.getElementById('cardDetailModal');
        if (cardDetailModal) {
            cardDetailModal.classList.add('show');
        }
    }

    getCardStatusText(status) {
        const statusMap = {
            0: '未開啟',
            1: '已鎖定',
            2: '已開啟',
        };
        return statusMap[status] || '未知';
    }

    closeCardDetailModal() {
        const cardDetailModal = document.getElementById('cardDetailModal');
        if (cardDetailModal) {
            cardDetailModal.classList.remove('show');
        }
    }

    showConfirmModal(title, message, callback) {
        document.getElementById('modalTitle').textContent = title;
        document.getElementById('modalMessage').textContent = message;
        const confirmModal = document.getElementById('confirmModal');
        if (confirmModal) {
            confirmModal.classList.add('show');
        }

        this.confirmCallback = callback;
    }

    closeConfirmModal() {
        const confirmModal = document.getElementById('confirmModal');
        if (confirmModal) {
            confirmModal.classList.remove('show');
        }
        this.confirmCallback = null;
    }

    executeConfirmedAction() {
        if (this.confirmCallback) {
            this.confirmCallback();
        }
        this.closeConfirmModal();
    }

    addActivityRecord(description) {
        const activityList = document.getElementById('activityList');
        const noActivity = activityList.querySelector('.no-activity');

        if (noActivity) {
            noActivity.remove();
        }

        const activityItem = document.createElement('div');
        activityItem.className = 'activity-item';

        const descriptionDiv = document.createElement('div');
        descriptionDiv.className = 'activity-description';
        descriptionDiv.textContent = description;

        const timeDiv = document.createElement('div');
        timeDiv.className = 'activity-time';
        timeDiv.textContent = new Date().toLocaleString('zh-TW');

        activityItem.appendChild(descriptionDiv);
        activityItem.appendChild(timeDiv);

        activityList.insertBefore(activityItem, activityList.firstChild);

        // 限制顯示最近20筆記錄
        const items = activityList.querySelectorAll('.activity-item');
        if (items.length > 20) {
            items[items.length - 1].remove();
        }
    }

    showError(message) {
        alert(`錯誤: ${message}`);
    }

    showSuccess(message) {
        alert(`成功: ${message}`);
    }

    // 新增活動相關方法
    showCreateEventModal() {
        const createEventModal = document.getElementById('createEventModal');
        if (createEventModal) {
            createEventModal.classList.add('show');
        }
        this.resetCreateEventForm();
    }

    closeCreateEventModal() {
        const createEventModal = document.getElementById('createEventModal');
        if (createEventModal) {
            createEventModal.classList.remove('show');
        }
    }

    resetCreateEventForm() {
        document.getElementById('createEventForm').reset();
        const prizesContainer = document.getElementById('prizesContainer');
        prizesContainer.innerHTML = `
            <div class="prize-item">
                <input type="text" name="prizeName" placeholder="獎品名稱" required />
                <input type="number" name="prizeQuantity" placeholder="數量" min="1" value="1" required />
                <button type="button" class="btn btn-danger btn-sm remove-prize">移除</button>
            </div>
        `;
        this.setupPrizeItemEvents();
    }

    addPrizeItem() {
        const prizesContainer = document.getElementById('prizesContainer');
        const prizeItem = document.createElement('div');
        prizeItem.className = 'prize-item';
        prizeItem.innerHTML = `
            <input type="text" name="prizeName" placeholder="獎品名稱" required />
            <input type="number" name="prizeQuantity" placeholder="數量" min="1" value="1" required />
            <button type="button" class="btn btn-danger btn-sm remove-prize">移除</button>
        `;
        prizesContainer.appendChild(prizeItem);
        this.setupPrizeItemEvents();
    }

    setupPrizeItemEvents() {
        document.querySelectorAll('.remove-prize').forEach(btn => {
            btn.addEventListener('click', e => {
                e.target.closest('.prize-item').remove();
            });
        });
    }

    async createEvent() {
        const form = document.getElementById('createEventForm');
        const formData = new FormData(form);

        // 收集獎品資料
        const prizes = [];
        const prizeItems = document.querySelectorAll('.prize-item');
        prizeItems.forEach(item => {
            const name = item.querySelector('input[name="prizeName"]').value;
            const quantity = parseInt(
                item.querySelector('input[name="prizeQuantity"]').value
            );
            if (name && quantity > 0) {
                prizes.push({ prizeName: name, quantity });
            }
        });

        if (prizes.length === 0) {
            this.showError('請至少添加一個獎品');
            return;
        }

        const eventData = {
            merchantId: this.merchantId,
            eventName: formData.get('eventName'),
            description: formData.get('description'),
            totalCards: parseInt(formData.get('totalCards')),
            cost: parseInt(formData.get('cost')),
            startTime: formData.get('startTime') || null,
            endTime: formData.get('endTime') || null,
            prizes: prizes,
        };

        try {
            const response = await fetch('/api/v1/ichiban-events', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(eventData),
            });

            if (!response.ok) {
                throw new Error('創建活動失敗');
            }

            this.showSuccess('活動創建成功');
            this.closeCreateEventModal();
            this.loadEvents();
        } catch (error) {
            console.error('創建活動錯誤:', error);
            this.showError('創建活動失敗');
        }
    }

    // 開啟客戶端方法
    openClient(eventId) {
        const clientUrl = `ichiban-client.html?id=${eventId}&merchantId=${this.merchantId}`;
        window.open(clientUrl, '_blank');
    }

    // 定期發送心跳
    startHeartbeat() {
        setInterval(() => {
            if (this.isConnected) {
                this.ws.send(JSON.stringify({ type: 'ping' }));
            }
        }, 30000);
    }
}

// 頁面載入完成後初始化
document.addEventListener('DOMContentLoaded', () => {
    window.ichibanAdmin = new IchibanAdmin();
    window.ichibanAdmin.startHeartbeat();

    // 全局函數供HTML調用
    window.openClient = eventId => {
        window.ichibanAdmin.openClient(eventId);
    };
});
