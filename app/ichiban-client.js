// 引入CSS
import './css/ichiban-client.css';

class IchibanClient {
    constructor() {
        this.eventId = null;
        this.merchantId = null;
        this.ws = null;
        this.eventData = null;
        this.cards = [];
        this.isConnected = false;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;
        this.clientId = this.generateClientId(); // 生成固定的客戶端ID

        this.init();
    }

    init() {
        this.parseUrlParams();
        this.setupEventListeners();
        this.connectWebSocket();
        this.loadEventData();
    }

    parseUrlParams() {
        const urlParams = new URLSearchParams(window.location.search);
        this.eventId = urlParams.get('id');
        this.merchantId = urlParams.get('merchantId');

        if (!this.eventId || !this.merchantId) {
            this.showError('缺少必要的參數 (id 或 merchantId)');
            return;
        }
    }

    setupEventListeners() {
        const closeModal = document.getElementById('closeModal');
        if (closeModal) {
            closeModal.addEventListener('click', () => {
                this.closePrizeModal();
            });
        }

        const confirmPrize = document.getElementById('confirmPrize');
        if (confirmPrize) {
            confirmPrize.addEventListener('click', () => {
                this.closePrizeModal();
            });
        }

        // 點擊背景關閉模態框
        const prizeModal = document.getElementById('prizeModal');
        if (prizeModal) {
            prizeModal.addEventListener('click', e => {
                if (e.target.id === 'prizeModal') {
                    this.closePrizeModal();
                }
            });
        }
    }

    connectWebSocket() {
        const wsUrl = `ws://localhost:3002?merchantId=${this.merchantId}`;

        try {
            this.ws = new WebSocket(wsUrl);

            this.ws.onopen = () => {
                console.log('WebSocket 連接成功');
                this.isConnected = true;
                this.reconnectAttempts = 0;
                this.updateConnectionStatus(true);
                this.joinEvent();
            };

            this.ws.onmessage = event => {
                const message = JSON.parse(event.data);
                // 如果是連接成功訊息，更新客戶端ID
                if (message.type === 'connected' && message.clientId) {
                    this.clientId = message.clientId;
                    console.log('Updated client ID:', this.clientId);
                }
                this.handleWebSocketMessage(message);
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

        if (connected) {
            statusIndicator.classList.add('connected');
            statusText.textContent = '已連線';
        } else {
            statusIndicator.classList.remove('connected');
            statusText.textContent = '連線中斷';
        }
    }

    handleWebSocketMessage(message) {
        console.log('收到 WebSocket 訊息:', message);

        switch (message.type) {
            case 'connected':
                console.log('已連接到商戶房間');
                break;
            case 'event-joined':
                console.log('已加入事件房間');
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
            case 'card-payment-failed':
                this.handleCardPaymentFailed(message);
                break;
            case 'card-payment-failed-notification':
                this.handleCardPaymentFailedNotification(message);
                break;
            case 'event-ended':
                this.handleEventEnded(message);
                break;
            case 'event-ended-notification':
                this.handleEventEndedNotification(message);
                break;
            case 'payment-redirect':
                this.handlePaymentRedirect(message);
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
        // 更新卡片狀態為已鎖定
        this.updateCardStatus(message.cardIndex, 'locked');

        // 更新事件統計
        this.updateEventStats();
    }

    handleCardOpened(message) {
        // 更新卡片狀態為已開啟
        this.updateCardStatus(message.cardIndex, 'opened', message.prizeName);

        // 如果是自己抽的卡，顯示獎品模態框
        if (message.openedBy === this.getClientId()) {
            this.showPrizeModal(message.prizeName);
        }

        // 更新事件統計
        this.updateEventStats();
    }

    handleCardOpenedNotification(message) {
        // 更新卡片狀態為已開啟（通知其他客戶端）
        this.updateCardStatus(message.cardIndex, 'opened', message.prizeName);

        // 更新事件統計
        this.updateEventStats();

        // 添加活動記錄
        this.addRecentDraw(message.prizeName, message.timestamp);
    }

    handleCardLockedNotification(message) {
        this.updateCardStatus(message.cardIndex, 'locked');
        this.updateEventStats();
    }

    handleCardsReset(message) {
        // 重新載入事件資料但不重新渲染卡片
        this.loadEventDataWithoutRendering();
        console.log('卡片已重置');
        this.showSuccess('卡片已重置');
    }

    handleCardsResetNotification(message) {
        // 重新載入事件資料但不重新渲染卡片
        this.loadEventDataWithoutRendering();
        console.log('卡片已重置');
        this.showSuccess('卡片已重置');
    }

    handleCardsLocked(message) {
        // 重新載入事件資料但不重新渲染卡片
        this.loadEventDataWithoutRendering();
        console.log(`已鎖定 ${message.lockedCount} 張卡片`);
        this.showSuccess(`已鎖定 ${message.lockedCount} 張卡片`);
    }

    handleCardsLockedNotification(message) {
        // 重新載入事件資料但不重新渲染卡片
        this.loadEventDataWithoutRendering();
        console.log(`已鎖定 ${message.lockedCount} 張卡片`);
        this.showSuccess(`已鎖定 ${message.lockedCount} 張卡片`);
    }

    handleCardPaymentFailed(message) {
        // 付款失敗，恢復卡片為可點擊狀態
        this.updateCardStatus(message.cardIndex, 'closed');

        // 延遲一下讓用戶看到卡片恢復為藍色
        setTimeout(() => {
            // 顯示錯誤訊息並關閉視窗
            alert('付款失敗，請重試');

            // 關閉視窗
            window.close();
        }, 500); // 延遲500毫秒
    }

    handleCardPaymentFailedNotification(message) {
        // 其他用戶看到付款失敗，恢復卡片為可點擊狀態
        this.updateCardStatus(message.cardIndex, 'closed');
        this.updateEventStats();
    }

    handleEventEnded(message) {
        // 活動結束，顯示提示訊息
        this.showSuccess('活動已結束 - 所有卡片都已開啟！');

        // 重新載入事件資料以更新狀態
        this.loadEventData();
    }

    handleEventEndedNotification(message) {
        this.showSuccess('活動已結束 - 所有卡片都已開啟！');

        // 重新載入事件資料以更新狀態
        this.loadEventData();
    }

    handlePaymentRedirect(message) {
        // 顯示付款確認對話框
        const confirmMessage = `即將跳轉到付款頁面\n金額: $${message.amount}\n卡片: ${message.cardIndex + 1}`;

        if (confirm(confirmMessage)) {
            // 用戶確認後，創建並提交綠界付款表單
            this.submitEcpayForm(message.params, message.paymentUrl);
        } else {
            // 用戶取消付款，發送取消付款訊息到後端
            this.cancelPayment(message.eventId, message.cardIndex);
        }
    }

    cancelPayment(eventId, cardIndex) {
        if (!this.isConnected) {
            this.showError('WebSocket 未連接');
            return;
        }

        // 發送取消付款訊息到WebSocket
        const message = {
            type: 'cancel-payment',
            eventId: eventId,
            cardIndex: cardIndex,
        };

        this.ws.send(JSON.stringify(message));
        console.log('已發送取消付款訊息');
    }

    submitEcpayForm(params, paymentUrl) {
        console.log('收到的付款參數:', params);
        console.log('付款URL:', paymentUrl);

        // 創建表單元素
        const form = document.createElement('form');
        form.method = 'POST';
        form.action = paymentUrl;
        form.target = '_blank';

        // 將所有參數添加到表單中
        Object.keys(params).forEach(key => {
            const input = document.createElement('input');
            input.type = 'hidden';
            input.name = key;
            input.value = params[key];
            form.appendChild(input);
        });

        // 將表單添加到頁面並自動提交
        document.body.appendChild(form);
        console.log('表單已添加到頁面，準備提交');

        form.submit();
        console.log('表單已提交');

        // 提交後移除表單
        setTimeout(() => {
            if (document.body.contains(form)) {
                document.body.removeChild(form);
                console.log('表單已移除');
            }
        }, 1000);
    }

    async loadEventData() {
        try {
            const response = await fetch(
                `/api/v1/ichiban-events/id=${this.eventId}/merchantId=${this.merchantId}`
            );
            if (!response.ok) {
                throw new Error('載入事件資料失敗');
            }

            this.eventData = await response.json();
            this.cards = this.eventData.cards || [];

            this.renderEventInfo();
            this.renderCards();
        } catch (error) {
            console.error('載入事件資料錯誤:', error);
            this.showError('載入事件資料失敗');
        }
    }

    async loadEventDataWithoutRendering() {
        try {
            const response = await fetch(
                `/api/v1/ichiban-events/id=${this.eventId}/merchantId=${this.merchantId}`
            );
            if (!response.ok) {
                throw new Error('載入事件資料失敗');
            }

            this.eventData = await response.json();
            this.cards = this.eventData.cards || [];

            this.renderEventInfo();
            // 只更新卡片狀態，不重新渲染整個網格
            this.updateAllCardsStatus();
        } catch (error) {
            console.error('載入事件資料錯誤:', error);
            this.showError('載入事件資料失敗');
        }
    }

    renderEventInfo() {
        console.log(this.eventData);
        document.getElementById('eventTitle').textContent =
            this.eventData.eventName;
        document.getElementById('eventCost').textContent =
            `$${this.eventData.cost}`;
        document.getElementById('eventDescription').textContent =
            this.eventData.description;

        // 更新狀態
        const statusElement = document.getElementById('eventStatus');
        statusElement.textContent = this.getStatusText(this.eventData.status);
        statusElement.className = `event-status ${this.getStatusClass(this.eventData.status)}`;
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

    renderCards() {
        const container = document.getElementById('cardsContainer');

        if (!this.cards.length) {
            container.innerHTML = '<div class="loading">無卡片資料</div>';
            return;
        }

        const cardsGrid = document.createElement('div');
        cardsGrid.className = 'cards-grid';

        this.cards.forEach((card, index) => {
            const cardElement = this.createCardElement(card, index);
            cardsGrid.appendChild(cardElement);
        });

        container.innerHTML = '';
        container.appendChild(cardsGrid);
    }

    createCardElement(card, index) {
        const cardDiv = document.createElement('div');
        cardDiv.className = `card ${this.getCardClass(card.status)}`;
        cardDiv.dataset.cardIndex = index;

        // 創建卡片編號
        const cardNumber = document.createElement('div');
        cardNumber.className = 'card-number';
        cardNumber.textContent = index + 1;
        cardDiv.appendChild(cardNumber);

        // 根據狀態添加相應內容
        if (card.status === 2 && card.prize?.prizeName) {
            // 已開啟狀態，顯示獎品
            const cardPrize = document.createElement('div');
            cardPrize.className = 'card-prize';
            cardPrize.textContent = card.prize.prizeName;
            cardDiv.appendChild(cardPrize);
        } else if (card.status === 1) {
            // 已鎖定狀態，顯示載入動畫
            const loadingSpinner = document.createElement('div');
            cardDiv.appendChild(loadingSpinner);
        }

        // 只有未開啟的卡片可以點擊
        if (card.status === 0) {
            cardDiv.addEventListener('click', () => {
                this.drawSpecificCard(index);
            });
        }

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
            cardElement.className = `card ${status}`;
            cardElement.style.cursor =
                status === 'opened' ? 'default' : 'pointer';

            // 只更新必要的內容，不重新創建整個卡片
            const cardNumber = cardElement.querySelector('.card-number');
            const cardPrize = cardElement.querySelector('.card-prize');
            const loadingSpinner =
                cardElement.querySelector('.loading-spinner');

            // 確保卡片編號存在
            if (!cardNumber) {
                const numberDiv = document.createElement('div');
                numberDiv.className = 'card-number';
                numberDiv.textContent = cardIndex + 1;
                cardElement.appendChild(numberDiv);
            } else {
                cardNumber.textContent = cardIndex + 1;
            }

            // 處理獎品顯示
            if (status === 'opened') {
                // 移除載入動畫
                if (loadingSpinner) {
                    loadingSpinner.remove();
                }

                // 更新或創建獎品顯示
                if (!cardPrize) {
                    const prizeDiv = document.createElement('div');
                    prizeDiv.className = 'card-prize';
                    prizeDiv.textContent = prizeName || '未知獎品';
                    cardElement.appendChild(prizeDiv);
                } else {
                    cardPrize.textContent = prizeName || '未知獎品';
                }
            } else if (status === 'locked') {
                // 移除獎品顯示
                if (cardPrize) {
                    cardPrize.remove();
                }

                // 添加載入動畫
                if (!loadingSpinner) {
                    const spinnerDiv = document.createElement('div');
                    cardElement.appendChild(spinnerDiv);
                }
            } else {
                // closed 狀態，移除所有額外元素
                if (cardPrize) {
                    cardPrize.remove();
                }
                if (loadingSpinner) {
                    loadingSpinner.remove();
                }
            }
        }

        // 更新本地資料
        if (this.cards[cardIndex]) {
            this.cards[cardIndex].status =
                status === 'opened' ? 2 : status === 'locked' ? 1 : 0;
            if (prizeName) {
                this.cards[cardIndex].prize = { prizeName };
            }
        }
    }

    setCardLocked(cardIndex) {
        const cardElement = document.querySelector(
            `[data-card-index="${cardIndex}"]`
        );
        if (cardElement) {
            cardElement.className = 'card locked';
            cardElement.style.cursor = 'not-allowed';

            // 確保卡片編號存在
            let cardNumber = cardElement.querySelector('.card-number');
            if (!cardNumber) {
                cardNumber = document.createElement('div');
                cardNumber.className = 'card-number';
                cardNumber.textContent = cardIndex + 1;
                cardElement.appendChild(cardNumber);
            } else {
                cardNumber.textContent = cardIndex + 1;
            }

            // 移除獎品顯示（如果存在）
            const cardPrize = cardElement.querySelector('.card-prize');
            if (cardPrize) {
                cardPrize.remove();
            }

            // 添加載入動畫
            const loadingSpinner =
                cardElement.querySelector('.loading-spinner');
            if (!loadingSpinner) {
                const spinnerDiv = document.createElement('div');
                cardElement.appendChild(spinnerDiv);
            }
        }

        // 更新本地資料
        if (this.cards[cardIndex]) {
            this.cards[cardIndex].status = 1; // locked
        }
    }

    drawCard() {
        if (!this.isConnected) {
            this.showError('WebSocket 未連接');
            return;
        }

        // 隨機選擇一張未開啟的卡片
        const availableCards = this.cards
            .map((card, index) => ({ card, index }))
            .filter(({ card }) => card.status === 0);

        if (!availableCards.length) {
            this.showError('沒有可抽的卡片');
            return;
        }

        const randomIndex = Math.floor(Math.random() * availableCards.length);
        const selectedCard = availableCards[randomIndex];

        this.drawSpecificCard(selectedCard.index);
    }

    drawSpecificCard(cardIndex) {
        if (!this.isConnected) {
            this.showError('WebSocket 未連接');
            return;
        }

        // 檢查卡片是否已被鎖定或開啟
        if (this.cards[cardIndex].status !== 0) {
            this.showError('此卡片已被選中或已開啟');
            return;
        }

        // 立即將卡片設為 lock 狀態，提供即時反饋
        this.setCardLocked(cardIndex);

        // 發送鎖定卡片訊息到WebSocket
        const message = {
            type: 'lock-card',
            eventId: this.eventId,
            cardIndex: cardIndex,
        };

        this.ws.send(JSON.stringify(message));
    }

    joinEvent() {
        if (!this.isConnected) {
            return;
        }

        const message = {
            type: 'join-event',
            eventId: this.eventId,
        };

        this.ws.send(JSON.stringify(message));
    }

    showPrizeModal(prizeName) {
        const prizeNameElement = document.getElementById('prizeName');
        const prizeDescriptionElement =
            document.getElementById('prizeDescription');
        const prizeModalElement = document.getElementById('prizeModal');

        if (prizeNameElement) {
            prizeNameElement.textContent = prizeName;
        }
        if (prizeDescriptionElement) {
            prizeDescriptionElement.textContent = '恭喜您獲得此獎品！';
        }
        if (prizeModalElement) {
            prizeModalElement.classList.add('show');
        }
    }

    closePrizeModal() {
        const prizeModalElement = document.getElementById('prizeModal');
        if (prizeModalElement) {
            prizeModalElement.classList.remove('show');
        }
    }

    addRecentDraw(prizeName, timestamp) {
        const drawsList = document.getElementById('drawsList');
        if (!drawsList) {
            console.log(
                'drawsList element not found, skipping recent draw record'
            );
            return;
        }

        const noDraws = drawsList.querySelector('.no-draws');

        if (noDraws) {
            noDraws.remove();
        }

        const drawItem = document.createElement('div');
        drawItem.className = 'draw-item';

        const prizeDiv = document.createElement('div');
        prizeDiv.className = 'draw-prize';
        prizeDiv.textContent = prizeName;

        const timeDiv = document.createElement('div');
        timeDiv.className = 'draw-time';
        timeDiv.textContent = new Date(timestamp).toLocaleString('zh-TW');

        drawItem.appendChild(prizeDiv);
        drawItem.appendChild(timeDiv);

        drawsList.insertBefore(drawItem, drawsList.firstChild);

        // 限制顯示最近10筆記錄
        const items = drawsList.querySelectorAll('.draw-item');
        if (items.length > 10) {
            items[items.length - 1].remove();
        }
    }

    getClientId() {
        return this.clientId;
    }

    generateClientId() {
        // 生成固定的客戶端ID
        return `client_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    updateAllCardsStatus() {
        // 更新所有卡片的狀態，但不重新創建DOM元素
        this.cards.forEach((card, index) => {
            const cardElement = document.querySelector(
                `[data-card-index="${index}"]`
            );

            if (cardElement) {
                // 更新卡片類別
                cardElement.className = `card ${this.getCardClass(card.status)}`;

                // 更新卡片內容
                const cardNumber = cardElement.querySelector('.card-number');
                const cardPrize = cardElement.querySelector('.card-prize');
                const loadingSpinner =
                    cardElement.querySelector('.loading-spinner');

                // 確保卡片編號存在
                if (!cardNumber) {
                    const numberDiv = document.createElement('div');
                    numberDiv.className = 'card-number';
                    numberDiv.textContent = index + 1;
                    cardElement.appendChild(numberDiv);
                } else {
                    cardNumber.textContent = index + 1;
                }

                // 根據狀態更新內容
                if (card.status === 2) {
                    // 已開啟狀態
                    if (loadingSpinner) {
                        loadingSpinner.remove();
                    }

                    if (!cardPrize) {
                        const prizeDiv = document.createElement('div');
                        prizeDiv.className = 'card-prize';
                        prizeDiv.textContent =
                            card.prize?.prizeName || '未知獎品';
                        cardElement.appendChild(prizeDiv);
                    } else {
                        cardPrize.textContent =
                            card.prize?.prizeName || '未知獎品';
                    }

                    // 移除點擊事件
                    cardElement.replaceWith(cardElement.cloneNode(true));
                } else if (card.status === 1) {
                    // 已鎖定狀態
                    if (cardPrize) {
                        cardPrize.remove();
                    }

                    if (!loadingSpinner) {
                        const spinnerDiv = document.createElement('div');
                        cardElement.appendChild(spinnerDiv);
                    }
                } else {
                    // 未開啟狀態
                    if (cardPrize) {
                        cardPrize.remove();
                    }
                    if (loadingSpinner) {
                        loadingSpinner.remove();
                    }

                    // 重新添加點擊事件
                    cardElement.addEventListener('click', () => {
                        this.drawSpecificCard(index);
                    });
                }
            }
        });

        // 更新統計
        this.updateEventStats();
    }

    updateEventStats() {
        // 計算已開啟的卡片數量
        const openedCards = this.cards.filter(card => card.status === 2).length;
        const totalCards = this.cards.length;
        const remainingCards = totalCards - openedCards;
        const completionRate =
            totalCards > 0 ? Math.round((openedCards / totalCards) * 100) : 0;

        // 更新狀態顯示（如果頁面有這些元素的話）
        const openedCardsElement = document.getElementById('openedCards');
        const remainingCardsElement = document.getElementById('remainingCards');
        const completionRateElement = document.getElementById('completionRate');

        if (openedCardsElement) {
            openedCardsElement.textContent = openedCards;
        }
        if (remainingCardsElement) {
            remainingCardsElement.textContent = remainingCards;
        }
        if (completionRateElement) {
            completionRateElement.textContent = `${completionRate}%`;
        }
    }

    showError(message) {
        alert(`錯誤: ${message}`);
    }

    showSuccess(message) {
        // 可以改為更優雅的提示方式，比如 toast 通知
        console.log(`成功: ${message}`);
        // 暫時使用 alert，之後可以改為更好的 UI 提示
        // alert(`成功: ${message}`);
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
    window.ichibanClient = new IchibanClient();
    window.ichibanClient.startHeartbeat();
});
