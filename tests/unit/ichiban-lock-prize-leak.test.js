/**
 * 資安重現：一番賞鎖卡流程
 *
 * 1. 偷看獎品：lock-card 一鎖卡就把 prizeName 廣播給整個活動房間（含鎖卡者本人），
 *    這時還沒付款。再送 cancel-payment 把卡放回去，就能不花錢把每張卡翻一遍，
 *    最後只付錢抽大獎。
 * 2. 取消別人的卡：cancel-payment 不檢查是誰鎖的，任何連線都能把別人付款中的卡
 *    放回 CLOSED；對方付完款後回調找不到 LOCKED 的卡，錢付了、卡沒開。
 *
 * 標 [重現] 的案例修好前會失敗；標 [對照] 的案例修好前後都應通過。
 *
 * ⚠ 一番賞流程尚在調整，[重現] 暫時以 test.failing 標記：
 *   「測試失敗」才算通過，CI 維持綠燈，同時保留重現證據。
 *   修好之後這些案例會變成「意外通過」而讓 CI 變紅 —— 屆時把 test.failing 改回 test 即可。
 */
jest.mock('../../server/store/ichiban-event', () => ({
    getIchibanEventByIdAndMerchantId: jest.fn(),
}));
jest.mock('../../server/store/ichiban-card', () => ({
    getIchibanCardByEventIdAndCardIndexAndStatus: jest.fn(),
    updateIchibanCardByIdAndStatus: jest.fn(),
}));
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
const IchibanEventStore = require('../../server/store/ichiban-event');
const IchibanCardStore = require('../../server/store/ichiban-card');

const MERCHANT = 'M1';
const EVENT_ID = 10;
const CARD_INDEX = 3;
const PRIZE = 'A賞・限定公仔';

function createFakeWs() {
    const ws = new EventEmitter();
    ws.readyState = WebSocket.OPEN;
    ws.send = jest.fn();
    ws.close = jest.fn();
    ws.terminate = jest.fn();
    ws.ping = jest.fn();
    return ws;
}

/** 收到的所有訊息（已 JSON.parse） */
function received(ws) {
    return ws.send.mock.calls.map(([raw]) => JSON.parse(raw));
}

/**
 * 用一個簡單的記憶體狀態模擬卡片表，讓 lock / cancel 會真的改到狀態。
 */
function installCardTable() {
    const card = {
        id: 555,
        eventId: EVENT_ID,
        cardIndex: CARD_INDEX,
        status: expectStatus('closed'),
        prize: { prizeName: PRIZE },
    };
    IchibanCardStore.getIchibanCardByEventIdAndCardIndexAndStatus.mockImplementation(
        async (eventId, cardIndex, status) =>
            eventId === card.eventId &&
            cardIndex === card.cardIndex &&
            status === card.status
                ? card
                : null
    );
    IchibanCardStore.updateIchibanCardByIdAndStatus.mockImplementation(
        async (id, patch) => {
            if (id === card.id) Object.assign(card, patch);
        }
    );
    return card;
}

describe('一番賞鎖卡流程', () => {
    let httpServer;
    let server;
    let card;
    let attackerWs;
    let viewerWs;

    beforeEach(async () => {
        httpServer = http.createServer();
        server = new IchibanWebSocketServer(httpServer);
        card = installCardTable();
        IchibanEventStore.getIchibanEventByIdAndMerchantId.mockResolvedValue({
            id: EVENT_ID,
            merchantId: MERCHANT,
        });

        // 兩個匿名觀眾都在同一個活動房間
        for (const [clientId, key] of [
            ['c-attacker', 'attackerWs'],
            ['c-viewer', 'viewerWs'],
        ]) {
            const ws = createFakeWs();
            server.clients.set(clientId, {
                ws,
                merchantId: MERCHANT,
                lastActivity: Date.now(),
                rooms: new Set(),
            });
            server.joinRoom(clientId, `event-${EVENT_ID}`);
            if (key === 'attackerWs') attackerWs = ws;
            else viewerWs = ws;
        }
    });

    afterEach(done => {
        server.paymentTimeouts.forEach(t => clearTimeout(t));
        server.wss.close(() => done());
    });

    test.failing('[重現] 鎖卡（尚未付款）時，任何人都不應收到獎品名稱', async () => {
        await server.handleMessage('c-attacker', {
            type: 'lock-card',
            eventId: EVENT_ID,
            cardIndex: CARD_INDEX,
        });

        // 前提：卡片確實被鎖了
        expect(card.status).toBe(expectStatus('locked'));

        const leaked = [...received(attackerWs), ...received(viewerWs)].filter(
            m => JSON.stringify(m).includes(PRIZE)
        );
        // 目前：card-locked 訊息帶 prizeName，鎖卡者和其他觀眾都看得到
        expect(leaked).toEqual([]);
    });

    test.failing('[重現] 不能「鎖卡→看獎品→取消」：取消後卡片回到可抽，而且獎品已外洩', async () => {
        await server.handleMessage('c-attacker', {
            type: 'lock-card',
            eventId: EVENT_ID,
            cardIndex: CARD_INDEX,
        });
        await server.handleMessage('c-attacker', {
            type: 'cancel-payment',
            eventId: EVENT_ID,
            cardIndex: CARD_INDEX,
        });

        const sawPrizeBeforePaying = received(attackerWs).some(m =>
            JSON.stringify(m).includes(PRIZE)
        );
        // 自己取消自己的卡是合理的；問題在於取消之前已經看到獎品
        expect(card.status).toBe(expectStatus('closed'));
        expect(sawPrizeBeforePaying).toBe(false);
    });

    test.failing('[重現] 其他觀眾不能取消別人鎖住的卡', async () => {
        await server.handleMessage('c-viewer', {
            type: 'lock-card',
            eventId: EVENT_ID,
            cardIndex: CARD_INDEX,
        });
        expect(card.status).toBe(expectStatus('locked'));

        await server.handleMessage('c-attacker', {
            type: 'cancel-payment',
            eventId: EVENT_ID,
            cardIndex: CARD_INDEX,
        });

        // 目前：卡被放回 closed，c-viewer 付完款後回調找不到 locked 的卡
        expect(card.status).toBe(expectStatus('locked'));
    });

    test('[對照] 鎖卡者本人可以取消自己的卡', async () => {
        await server.handleMessage('c-viewer', {
            type: 'lock-card',
            eventId: EVENT_ID,
            cardIndex: CARD_INDEX,
        });
        await server.handleMessage('c-viewer', {
            type: 'cancel-payment',
            eventId: EVENT_ID,
            cardIndex: CARD_INDEX,
        });

        expect(card.status).toBe(expectStatus('closed'));
    });
});

/** 卡片狀態值以 enum 為準，避免大小寫不同造成誤判 */
function expectStatus(name) {
    const { ENUM_ICHIBAN_CARD_STATUS } = require('../../server/lib/enum');
    return ENUM_ICHIBAN_CARD_STATUS[name.toUpperCase()];
}
