/**
 * IchibanWebSocketServer：房間管理與廣播（不建立真實連線）
 */
jest.mock('../../server/store/ichiban-event', () => ({}));
jest.mock('../../server/store/ichiban-card', () => ({}));
jest.mock('../../server/store/ecpay-config', () => ({
    getEcpayConfigByMerchantId: jest.fn(),
}));
jest.mock('../../server/store/payment-order', () => ({
    setPaymentOrder: jest.fn(),
    getPaymentOrderByEventAndCard: jest.fn(),
    deletePaymentOrder: jest.fn(),
}));
jest.mock('../../server/lib/payment-providers/ecpay', () => ({
    createPayment: jest.fn(),
}));
jest.mock('../../server/lib/payment-providers/payuni', () => ({
    createPayment: jest.fn(),
}));
jest.mock('../../server/service/check-youtube-live-streams', () => ({
    updateMerchantActiveTime: jest.fn(),
}));

const http = require('http');
const { EventEmitter } = require('events');
const WebSocket = require('ws');
const IchibanWebSocketServer = require('../../server/web-socket/server');
const {
    updateMerchantActiveTime,
} = require('../../server/service/check-youtube-live-streams');

function createFakeWs() {
    const ws = new EventEmitter();
    ws.readyState = WebSocket.OPEN;
    ws.send = jest.fn();
    ws.close = jest.fn();
    ws.terminate = jest.fn();
    ws.ping = jest.fn();
    return ws;
}

function addFakeClient(server, clientId, merchantId) {
    const ws = createFakeWs();
    server.clients.set(clientId, {
        ws,
        merchantId,
        lastActivity: Date.now(),
        rooms: new Set(),
    });
    return ws;
}

describe('IchibanWebSocketServer', () => {
    let httpServer;
    let server;

    beforeEach(() => {
        httpServer = http.createServer();
        server = new IchibanWebSocketServer(httpServer);
    });

    afterEach(done => {
        server.wss.close(() => done());
    });

    describe('verifyClient', () => {
        test('缺 merchantId 拒絕連線', () => {
            const info = {
                req: { url: '/', headers: { host: 'localhost' } },
            };
            expect(server.verifyClient(info)).toBe(false);
        });

        test('帶 merchantId 允許連線', () => {
            const info = {
                req: {
                    url: '/?merchantId=M1',
                    headers: { host: 'localhost' },
                },
            };
            expect(server.verifyClient(info)).toBe(true);
        });
    });

    describe('房間管理', () => {
        test('joinRoom / leaveRoom 正確維護狀態', () => {
            addFakeClient(server, 'c1', 'M1');

            server.joinRoom('c1', 'merchant-M1');
            expect(server.rooms.get('merchant-M1').has('c1')).toBe(true);
            expect(server.clients.get('c1').rooms.has('merchant-M1')).toBe(
                true
            );

            server.leaveRoom('c1', 'merchant-M1');
            // 空房間應被清除
            expect(server.rooms.has('merchant-M1')).toBe(false);
            expect(server.clients.get('c1').rooms.has('merchant-M1')).toBe(
                false
            );
        });

        test('對不存在的 client joinRoom 不噴錯', () => {
            expect(() => server.joinRoom('ghost', 'room-x')).not.toThrow();
            expect(server.rooms.has('room-x')).toBe(false);
        });
    });

    describe('broadcastToMerchant', () => {
        test('只推播給該商家房間的 client', () => {
            const wsA = addFakeClient(server, 'a', 'M1');
            const wsB = addFakeClient(server, 'b', 'M1');
            const wsC = addFakeClient(server, 'c', 'M2');
            server.joinRoom('a', 'merchant-M1');
            server.joinRoom('b', 'merchant-M1');
            server.joinRoom('c', 'merchant-M2');

            const payload = { type: 'new-donation', name: 'X', cost: 100 };
            server.broadcastToMerchant('M1', payload);

            expect(wsA.send).toHaveBeenCalledWith(JSON.stringify(payload));
            expect(wsB.send).toHaveBeenCalledWith(JSON.stringify(payload));
            expect(wsC.send).not.toHaveBeenCalled();
        });

        test('房間不存在時不噴錯', () => {
            expect(() =>
                server.broadcastToMerchant('nobody', { type: 'x' })
            ).not.toThrow();
        });
    });

    describe('sendMessage', () => {
        test('連線開啟時送出並回 true', () => {
            const ws = addFakeClient(server, 'c1', 'M1');
            const ok = server.sendMessage('c1', { type: 'hello' });
            expect(ok).toBe(true);
            expect(ws.send).toHaveBeenCalled();
        });

        test('連線已關閉回 false', () => {
            const ws = addFakeClient(server, 'c1', 'M1');
            ws.readyState = WebSocket.CLOSED;
            expect(server.sendMessage('c1', { type: 'hello' })).toBe(false);
        });

        test('client 不存在回 false', () => {
            expect(server.sendMessage('ghost', { type: 'hello' })).toBe(
                false
            );
        });
    });

    describe('connection 流程', () => {
        test('新連線加入 merchant 房間並收到 connected 訊息', () => {
            const ws = createFakeWs();
            const req = {
                url: '/?merchantId=M9',
                headers: { host: 'localhost' },
            };

            server.wss.emit('connection', ws, req);

            expect(updateMerchantActiveTime).toHaveBeenCalledWith('M9');
            expect(server.rooms.get('merchant-M9').size).toBe(1);

            const sent = JSON.parse(ws.send.mock.calls[0][0]);
            expect(sent.type).toBe('connected');
            expect(sent.merchantId).toBe('M9');
        });

        test('連線關閉後清出房間', () => {
            const ws = createFakeWs();
            const req = {
                url: '/?merchantId=M9',
                headers: { host: 'localhost' },
            };
            server.wss.emit('connection', ws, req);
            expect(server.rooms.get('merchant-M9').size).toBe(1);

            ws.emit('close');

            expect(server.rooms.has('merchant-M9')).toBe(false);
            expect(server.clients.size).toBe(0);
        });
    });

    describe('getRoomInfo', () => {
        test('回傳房間與人數', () => {
            addFakeClient(server, 'c1', 'M1');
            server.joinRoom('c1', 'merchant-M1');
            const info = server.getRoomInfo();
            expect(info['merchant-M1'].clientCount).toBe(1);
        });
    });
});
