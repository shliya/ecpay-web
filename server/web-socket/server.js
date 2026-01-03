const WebSocket = require('ws');
const http = require('http');
const IchibanEventStore = require('../store/ichiban-event');
const IchibanCardStore = require('../store/ichiban-card');
const { ENUM_ICHIBAN_CARD_STATUS } = require('../lib/enum');
const { createPayment } = require('../lib/ecpayAPI');
const { setPaymentOrder } = require('../store/payment-order');
const { ENUM_ICHIBAN_EVENT_STATUS } = require('../lib/enum');

const {
    updateMerchantActiveTime,
} = require('../service/check-youtube-live-streams');

class IchibanWebSocketServer {
    constructor(server = null) {
        this.server = server;
        this.clients = new Map();
        this.rooms = new Map();
        this.paymentTimeouts = new Map(); // 存儲付款超時計時器
        this.paymentTimeoutDuration = 5 * 60 * 1000; // 5分鐘超時

        if (this.server) {
            this.wss = new WebSocket.Server({
                server: this.server,
                verifyClient: this.verifyClient.bind(this),
            });
        } else {
            const port = process.env.WEBSOCKET_PORT || 3002;
            this.server = http.createServer();
            this.wss = new WebSocket.Server({
                server: this.server,
                verifyClient: this.verifyClient.bind(this),
            });
            this.port = port;
        }

        this.setupEventHandlers();
    }

    verifyClient(info) {
        const url = new URL(info.req.url, `http://${info.req.headers.host}`);
        const merchantId = url.searchParams.get('merchantId');

        if (!merchantId) {
            console.log('WebSocket connection rejected: missing merchantId');
            return false;
        }

        console.log(
            `WebSocket connection attempt from merchantId: ${merchantId}`
        );
        return true;
    }

    setupEventHandlers() {
        this.wss.on('connection', (ws, req) => {
            const url = new URL(req.url, `http://${req.headers.host}`);
            const merchantId = url.searchParams.get('merchantId');
            const clientId = this.generateClientId();

            // 更新商家活躍狀態
            if (merchantId) {
                updateMerchantActiveTime(merchantId);
            }

            this.clients.set(clientId, {
                ws,
                merchantId,
                lastActivity: Date.now(),
                rooms: new Set(),
            });

            this.joinRoom(clientId, `merchant-${merchantId}`);

            console.log(
                `Client connected: ${clientId}, merchantId: ${merchantId}`
            );

            this.setupClientHandlers(clientId, ws);

            this.sendMessage(clientId, {
                type: 'connected',
                clientId,
                merchantId,
                message: `Connected to merchant room: merchant-${merchantId}`,
            });
        });
    }

    setupClientHandlers(clientId, ws) {
        ws.on('message', data => {
            try {
                const message = JSON.parse(data);
                this.handleMessage(clientId, message);
            } catch (error) {
                console.error('Invalid message format:', error);
                this.sendError(clientId, 'Invalid message format');
            }
        });

        ws.on('close', () => {
            this.handleDisconnect(clientId);
        });

        ws.on('error', error => {
            console.error(`Client ${clientId} error:`, error);
            this.handleDisconnect(clientId);
        });

        ws.on('pong', () => {
            const client = this.clients.get(clientId);
            if (client) {
                client.lastActivity = Date.now();
            }
        });
    }

    async handleMessage(clientId, message) {
        const client = this.clients.get(clientId);
        if (!client) return;

        try {
            switch (message.type) {
                case 'join-event':
                    await this.handleJoinEvent(clientId, message.eventId);
                    break;
                case 'leave-event':
                    this.handleLeaveEvent(clientId, message.eventId);
                    break;
                case 'open-card':
                    console.log('open-card:', message);
                    await this.handleOpenCard(
                        clientId,
                        message.eventId,
                        message.cardIndex
                    );
                    break;
                case 'lock-card':
                    console.log('lock-card:', message);
                    await this.handleLockCard(
                        clientId,
                        message.eventId,
                        message.cardIndex
                    );
                    break;
                case 'cancel-payment':
                    console.log('cancel-payment:', message);
                    await this.handleCancelPayment(
                        clientId,
                        message.eventId,
                        message.cardIndex
                    );
                    break;
                case 'ping':
                    if (client.merchantId) {
                        updateMerchantActiveTime(client.merchantId);
                    }
                    this.sendMessage(clientId, { type: 'pong' });
                    break;
                default:
                    console.log(`Unknown message type: ${message.type}`);
            }
        } catch (error) {
            console.error(`Error handling message:`, error);
            this.sendError(clientId, 'Internal server error');
        }
    }

    async handleJoinEvent(clientId, eventId) {
        const client = this.clients.get(clientId);
        if (!client) return;

        const event = await IchibanEventStore.getIchibanEventByIdAndMerchantId(
            eventId,
            client.merchantId
        );

        if (!event) {
            this.sendError(clientId, 'Event not found or access denied');
            return;
        }

        this.joinRoom(clientId, `event-${eventId}`);

        this.sendMessage(clientId, {
            type: 'event-joined',
            eventId: eventId,
            message: `Joined event room: event-${eventId}`,
        });

        console.log(
            `Client ${clientId} joined event ${eventId} (merchant: ${client.merchantId})`
        );
    }

    async handleOpenCard(clientId, eventId, cardIndex) {
        const client = this.clients.get(clientId);
        if (!client) return;

        try {
            const card =
                await IchibanCardStore.getIchibanCardByEventIdAndCardIndexAndStatus(
                    eventId,
                    cardIndex,
                    ENUM_ICHIBAN_CARD_STATUS.LOCKED
                );

            if (!card) {
                this.sendError(clientId, 'Card not found or not locked');
                return;
            }

            await IchibanCardStore.updateIchibanCardByIdAndStatus(card.id, {
                status: ENUM_ICHIBAN_CARD_STATUS.OPENED,
                openedAt: new Date(),
                openedBy: clientId,
            });

            this.clearPaymentTimeout(clientId, eventId, cardIndex);

            const eventUpdated =
                await IchibanEventStore.incrementOpenedCards(eventId);

            const prizeName = card.prize?.prizeName || '未知獎品';

            this.broadcastToRoom(`event-${eventId}`, {
                type: 'card-opened',
                eventId: eventId,
                cardIndex: cardIndex,
                prizeName: prizeName,
                openedBy: clientId,
                timestamp: new Date().toISOString(),
            });

            this.broadcastToRoom(`merchant-${client.merchantId}`, {
                type: 'card-opened-notification',
                eventId: eventId,
                cardIndex: cardIndex,
                prizeName: prizeName,
                openedBy: clientId,
                timestamp: new Date().toISOString(),
            });

            // 檢查活動是否已結束
            const event =
                await IchibanEventStore.getIchibanEventByIdAndMerchantId(
                    eventId,
                    client.merchantId
                );
            if (event && event.status === ENUM_ICHIBAN_EVENT_STATUS.ENDED) {
                // ENUM_ICHIBAN_EVENT_STATUS.ENDED
                this.broadcastToRoom(`event-${eventId}`, {
                    type: 'event-ended',
                    eventId: eventId,
                    message: '活動已結束 - 所有卡片都已開啟',
                    timestamp: new Date().toISOString(),
                });

                this.broadcastToRoom(`merchant-${client.merchantId}`, {
                    type: 'event-ended-notification',
                    eventId: eventId,
                    message: '活動已結束 - 所有卡片都已開啟',
                    timestamp: new Date().toISOString(),
                });
            }

            console.log(
                `Card ${cardIndex} opened in event ${eventId} by ${clientId} (merchant: ${client.merchantId}) - Prize: ${prizeName}`
            );
        } catch (error) {
            console.error('Error opening card:', error);
            this.sendError(clientId, 'Failed to open card');
        }
    }

    async handleLockCard(clientId, eventId, cardIndex) {
        const client = this.clients.get(clientId);
        if (!client) return;

        try {
            const card =
                await IchibanCardStore.getIchibanCardByEventIdAndCardIndexAndStatus(
                    eventId,
                    cardIndex,
                    ENUM_ICHIBAN_CARD_STATUS.CLOSED
                );

            if (!card) {
                this.sendError(clientId, 'Card not found or already opened');
                return;
            }

            await IchibanCardStore.updateIchibanCardByIdAndStatus(card.id, {
                status: ENUM_ICHIBAN_CARD_STATUS.LOCKED,
                openedAt: new Date(),
                openedBy: clientId,
            });

            const prizeName = card.prize?.prizeName || '未知獎品';

            this.broadcastToRoom(`event-${eventId}`, {
                type: 'card-locked',
                eventId: eventId,
                cardIndex: cardIndex,
                prizeName: prizeName,
                lockedBy: clientId,
                timestamp: new Date().toISOString(),
            });

            this.broadcastToRoom(`merchant-${client.merchantId}`, {
                type: 'card-locked-notification',
                eventId: eventId,
                cardIndex: cardIndex,
                prizeName: prizeName,
                lockedBy: clientId,
                timestamp: new Date().toISOString(),
            });

            console.log(
                `Card ${cardIndex} locked in event ${eventId} by ${clientId} (merchant: ${client.merchantId}) - Prize: ${prizeName}`
            );

            this.processPaymentAndOpenCard(
                clientId,
                eventId,
                cardIndex,
                card,
                client
            );
        } catch (error) {
            console.error('Error locking card:', error);
            this.sendError(clientId, 'Failed to lock card');
        }
    }

    async processPaymentAndOpenCard(
        clientId,
        eventId,
        cardIndex,
        card,
        client
    ) {
        const { merchantId } = client;
        try {
            console.log(`開始處理卡片 ${cardIndex} 的付款...`);

            // 獲取事件資訊以取得成本
            const event =
                await IchibanEventStore.getIchibanEventByIdAndMerchantId(
                    eventId,
                    client.merchantId
                );

            if (!event) {
                this.sendError(clientId, '事件不存在');
                return;
            }

            // 創建付款訂單
            const orderData = {
                amount: event.cost,
                description: `一番賞活動 - ${event.eventName}`,
                itemName: `卡片 ${cardIndex + 1}`,
            };

            console.log(`創建付款訂單，金額: ${orderData.amount}`);

            // 調用綠界API創建付款訂單
            const paymentResult = await createPayment(merchantId, orderData);
            setPaymentOrder(paymentResult.merchantTradeNo, {
                eventId: eventId,
                cardIndex: cardIndex,
                clientId: clientId,
                merchantId: client.merchantId,
            });
            this.sendMessage(clientId, {
                type: 'payment-redirect',
                params: paymentResult.params,
                paymentUrl: paymentResult.paymentUrl,
                eventId: eventId,
                cardIndex: cardIndex,
                amount: orderData.amount,
            });

            this.startPaymentTimeout(clientId, eventId, cardIndex);
        } catch (error) {
            console.error('Error processing payment:', error);
            this.sendError(clientId, 'Failed to process payment');
        }
    }

    async handleCancelPayment(clientId, eventId, cardIndex) {
        const client = this.clients.get(clientId);
        if (!client) return;

        try {
            // 找到對應的卡片
            const card =
                await IchibanCardStore.getIchibanCardByEventIdAndCardIndexAndStatus(
                    eventId,
                    cardIndex,
                    ENUM_ICHIBAN_CARD_STATUS.LOCKED
                );

            if (!card) {
                this.sendError(clientId, 'Card not found or not locked');
                return;
            }

            // 恢復卡片狀態為可點擊
            await IchibanCardStore.updateIchibanCardByIdAndStatus(card.id, {
                status: ENUM_ICHIBAN_CARD_STATUS.CLOSED,
                openedAt: null,
                openedBy: null,
            });

            this.clearPaymentTimeout(clientId, eventId, cardIndex);

            console.log(
                `Card ${cardIndex} payment cancelled in event ${eventId} by ${clientId} (merchant: ${client.merchantId})`
            );

            this.broadcastToRoom(`event-${eventId}`, {
                type: 'card-payment-failed',
                eventId: eventId,
                cardIndex: cardIndex,
                clientId: clientId,
                timestamp: new Date().toISOString(),
            });

            this.broadcastToRoom(`merchant-${client.merchantId}`, {
                type: 'card-payment-failed-notification',
                eventId: eventId,
                cardIndex: cardIndex,
                clientId: clientId,
                timestamp: new Date().toISOString(),
            });
        } catch (error) {
            console.error('Error cancelling payment:', error);
            this.sendError(clientId, 'Failed to cancel payment');
        }
    }

    handleLeaveEvent(clientId, eventId) {
        this.leaveRoom(clientId, `event-${eventId}`);
        console.log(`Client ${clientId} left event ${eventId}`);
    }

    joinRoom(clientId, roomName) {
        const client = this.clients.get(clientId);
        if (!client) return;

        client.rooms.add(roomName);

        if (!this.rooms.has(roomName)) {
            this.rooms.set(roomName, new Set());
        }
        this.rooms.get(roomName).add(clientId);

        console.log(`Client ${clientId} joined room: ${roomName}`);
    }

    leaveRoom(clientId, roomName) {
        const client = this.clients.get(clientId);
        if (!client) return;

        client.rooms.delete(roomName);

        const room = this.rooms.get(roomName);
        if (room) {
            room.delete(clientId);
            if (room.size === 0) {
                this.rooms.delete(roomName);
            }
        }

        console.log(`Client ${clientId} left room: ${roomName}`);
    }

    broadcastToRoom(roomName, message) {
        const room = this.rooms.get(roomName);
        if (!room) return;

        let sentCount = 0;
        room.forEach(clientId => {
            if (this.sendMessage(clientId, message)) {
                sentCount++;
            }
        });

        console.log(`Broadcasted to ${sentCount} clients in room: ${roomName}`);
    }

    broadcastToMerchant(merchantId, message) {
        this.broadcastToRoom(`merchant-${merchantId}`, message);
    }

    broadcastToEvent(eventId, message) {
        this.broadcastToRoom(`event-${eventId}`, message);
    }

    getRoomInfo() {
        const roomInfo = {};
        this.rooms.forEach((clients, roomName) => {
            roomInfo[roomName] = {
                clientCount: clients.size,
                clients: Array.from(clients),
            };
        });
        return roomInfo;
    }

    sendMessage(clientId, message) {
        const client = this.clients.get(clientId);
        if (!client || client.ws.readyState !== WebSocket.OPEN) return false;

        try {
            client.ws.send(JSON.stringify(message));
            return true;
        } catch (error) {
            console.error(`Failed to send message to ${clientId}:`, error);
            return false;
        }
    }

    sendError(clientId, errorMessage) {
        this.sendMessage(clientId, {
            type: 'error',
            message: errorMessage,
            timestamp: new Date().toISOString(),
        });
    }

    handleDisconnect(clientId) {
        const client = this.clients.get(clientId);
        if (!client) return;

        for (const [timeoutKey, timeout] of this.paymentTimeouts.entries()) {
            if (timeoutKey.startsWith(`${clientId}-`)) {
                clearTimeout(timeout);
                this.paymentTimeouts.delete(timeoutKey);
            }
        }

        client.rooms.forEach(roomName => {
            this.leaveRoom(clientId, roomName);
        });

        this.clients.delete(clientId);
        console.log(`Client disconnected: ${clientId}`);
    }

    generateClientId() {
        return `client_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    startPaymentTimeout(clientId, eventId, cardIndex) {
        const timeoutKey = `${clientId}-${eventId}-${cardIndex}`;
        const timeout = setTimeout(async () => {
            try {
                // 找到對應的卡片
                const card =
                    await IchibanCardStore.getIchibanCardByEventIdAndCardIndexAndStatus(
                        eventId,
                        cardIndex,
                        ENUM_ICHIBAN_CARD_STATUS.LOCKED
                    );

                if (card) {
                    // 恢復卡片狀態為可點擊
                    await IchibanCardStore.updateIchibanCardByIdAndStatus(
                        card.id,
                        {
                            status: ENUM_ICHIBAN_CARD_STATUS.CLOSED,
                            openedAt: null,
                            openedBy: null,
                        }
                    );

                    // 廣播付款超時訊息
                    this.broadcastToRoom(`event-${eventId}`, {
                        type: 'card-payment-failed',
                        eventId: eventId,
                        cardIndex: cardIndex,
                        clientId: clientId,
                        timestamp: new Date().toISOString(),
                        reason: 'payment-timeout',
                    });

                    const client = this.clients.get(clientId);
                    if (client) {
                        this.broadcastToRoom(`merchant-${client.merchantId}`, {
                            type: 'card-payment-failed-notification',
                            eventId: eventId,
                            cardIndex: cardIndex,
                            clientId: clientId,
                            timestamp: new Date().toISOString(),
                            reason: 'payment-timeout',
                        });
                    }

                    console.log(
                        `Card ${cardIndex} payment timeout in event ${eventId} by ${clientId}`
                    );
                }
            } catch (error) {
                console.error('Error handling payment timeout:', error);
            } finally {
                this.paymentTimeouts.delete(timeoutKey);
            }
        }, this.paymentTimeoutDuration);

        this.paymentTimeouts.set(timeoutKey, timeout);
    }

    // 清除付款超時計時器
    clearPaymentTimeout(clientId, eventId, cardIndex) {
        const timeoutKey = `${clientId}-${eventId}-${cardIndex}`;
        const timeout = this.paymentTimeouts.get(timeoutKey);

        if (timeout) {
            clearTimeout(timeout);
            this.paymentTimeouts.delete(timeoutKey);
        }
    }

    start() {
        if (this.port) {
            this.server.listen(this.port, () => {
                console.log(
                    `🎰 Ichiban WebSocket server running on port ${this.port}`
                );
            });
        } else {
            console.log(
                '🎰 Ichiban WebSocket server attached to existing HTTP server'
            );
        }

        setInterval(() => {
            this.clients.forEach((client, clientId) => {
                if (Date.now() - client.lastActivity > 30000) {
                    console.log(`Client ${clientId} ping timeout`);
                    client.ws.terminate();
                } else {
                    client.ws.ping();
                }
            });
        }, 10000);

        setInterval(() => {
            const roomInfo = this.getRoomInfo();
            console.log('Current rooms:', roomInfo);
        }, 60000);
    }

    stop() {
        this.wss.close();
        this.server.close();
    }
}

module.exports = IchibanWebSocketServer;
