/**
 * 資安重現：金流回調跨店偽造
 *
 * 情境：攻擊者用任何 Google 帳號自建商店（ATTACKER），在設定頁填入「自己的」
 * PayUni / 綠界金鑰。之後他對受害者（VICTIM）的大型募資頁或一番賞發起付款，
 * 產生一筆屬於 VICTIM 的 pending order，再用自己的金鑰簽一筆假回調，
 * 打到自己的 notify 網址，回調裡的單號填 VICTIM 那筆訂單。
 *
 * 驗簽會通過（金鑰確實是 ATTACKER 的），問題在於後續處理是依「訂單」決定
 * 要記到哪間店／打開哪張卡，從頭到尾沒比對「驗簽的店」和「訂單的店」是否同一間。
 *
 * 這支測試描述「修好之後應有的行為」，修正前標 [重現] 的案例會失敗；
 * 標 [對照] 的案例是正常流程，修好前後都應該通過，確保修正沒有誤殺。
 */
jest.mock('../../server/service/ecpay-config', () => ({
    getPayuniConfigByPayuniMerchantId: jest.fn(),
}));
jest.mock('../../server/store/ecpay-config', () => ({
    getEcpayConfigByMerchantId: jest.fn(),
}));
jest.mock('../../server/store/payment-order', () => ({
    getPaymentOrder: jest.fn(),
    getPaymentOrderForCallback: jest.fn(),
    markPaymentOrderCompleted: jest.fn(),
    revertPaymentOrderFromCompleted: jest.fn(),
    deletePaymentOrder: jest.fn(),
}));
jest.mock('../../server/service/large-crowdfunding-donation', () => ({
    completeDonationFromPayment: jest.fn(),
}));
jest.mock('../../server/store/ichiban-card', () => ({
    getIchibanCardByEventIdAndCardIndexAndStatus: jest.fn(),
    updateIchibanCardByIdAndStatus: jest.fn(),
}));
jest.mock('../../server/store/ichiban-event', () => ({
    getIchibanEventByIdAndMerchantId: jest.fn(),
}));
jest.mock('../../server/service/ichiban-event', () => ({
    incrementOpenedCards: jest.fn(),
}));

const crypto = require('crypto');
const querystring = require('querystring');

const {
    getPayuniConfigByPayuniMerchantId,
} = require('../../server/service/ecpay-config');
const { getEcpayConfigByMerchantId } = require('../../server/store/ecpay-config');
const {
    getPaymentOrder,
    getPaymentOrderForCallback,
    markPaymentOrderCompleted,
} = require('../../server/store/payment-order');
const {
    completeDonationFromPayment,
} = require('../../server/service/large-crowdfunding-donation');
const IchibanCardStore = require('../../server/store/ichiban-card');
const { genCheckMacValue } = require('../../server/lib/payment-providers/ecpay');
const payuni = require('../../server/lib/payment-providers/payuni');
const {
    resolveEcpayConfigIdForLcfPayment,
} = require('../../server/lib/large-crowdfunding-config');

const handlePayuniNotify = require('../../server/route-handlers/comme/handle-get-payuni-notify');
const handleEcpaySuccess = require('../../server/route-handlers/payment/handle-payment-success-request');

// ---- 兩間店 -------------------------------------------------------------
// PayUni 是 AES-256-GCM：key 32 bytes、IV 16 bytes
const ATTACKER = {
    id: 1,
    merchantId: 'ATTACKER',
    payuniMerchantId: 'ATTACKER_PU',
    payuniHashKey: 'A'.repeat(32),
    payuniHashIV: 'a'.repeat(16),
    hashKey: 'attackerEcpayKey',
    hashIV: 'attackerEcpayIV1',
};
const VICTIM = {
    id: 2,
    merchantId: 'VICTIM',
    payuniMerchantId: 'VICTIM_PU',
    payuniHashKey: 'V'.repeat(32),
    payuniHashIV: 'v'.repeat(16),
    hashKey: 'victimEcpayKey00',
    hashIV: 'victimEcpayIV000',
};

const VICTIM_TRADE_NO = 'PAYUNI1762750000000';

/**
 * 依 PayUni 回調格式（與 payment-providers/payuni.js 的 aesEncrypt / genHashInfo 相同）
 * 用「指定商店的金鑰」產生一筆付款成功回調。攻擊者手上有自己的金鑰，所以做得到。
 */
function forgePayuniNotify(store, { merTradeNo, amount }) {
    const plain = querystring.stringify({
        MerID: store.payuniMerchantId,
        MerTradeNo: merTradeNo,
        TradeAmt: String(amount),
        TradeStatus: '1',
        Status: 'SUCCESS',
    });
    const cipher = crypto.createCipheriv(
        'aes-256-gcm',
        store.payuniHashKey,
        store.payuniHashIV
    );
    let ct = cipher.update(plain, 'utf8', 'base64');
    ct += cipher.final('base64');
    const tag = cipher.getAuthTag().toString('base64');
    const EncryptInfo = Buffer.from(`${ct}:::${tag}`).toString('hex');
    const HashInfo = crypto
        .createHash('sha256')
        .update(`${store.payuniHashKey}${EncryptInfo}${store.payuniHashIV}`)
        .digest('hex')
        .toUpperCase();
    return {
        params: { merchantId: store.payuniMerchantId },
        body: { EncryptInfo, HashInfo },
        query: { name: 'x', msg: 'y' },
    };
}

/** notify handler 依 payuniMerchantId 查設定時回傳的欄位 */
function payuniConfigRow(store) {
    return {
        id: store.id,
        merchantId: store.merchantId,
        payuniMerchantId: store.payuniMerchantId,
        payuniHashKey: store.payuniHashKey,
        payuniHashIV: store.payuniHashIV,
        youtubeDonationAmount: null,
        youtubeDonationMaxPlaySec: null,
    };
}

function mockRes() {
    const res = {};
    res.status = jest.fn(() => res);
    res.send = jest.fn(() => res);
    res.json = jest.fn(() => res);
    return res;
}

function lcfPendingOrderOf(store) {
    return {
        kind: 'payuni-donation',
        status: 'pending',
        fullName: '受害者的觀眾',
        fullMessage: '',
        largeCrowdfundingPageId: 99,
        ecpayConfigId: store.id,
        amount: 500,
    };
}

function ichibanOrderOf(store) {
    return {
        kind: 'payuni-ichiban',
        status: 'pending',
        eventId: 10,
        cardIndex: 3,
        clientId: 'c-attacker',
        merchantId: store.merchantId,
        nickname: 'attacker',
    };
}

beforeEach(() => {
    getPayuniConfigByPayuniMerchantId.mockImplementation(async id =>
        [ATTACKER, VICTIM]
            .filter(s => s.payuniMerchantId === id)
            .map(payuniConfigRow)[0] || null
    );
    getEcpayConfigByMerchantId.mockImplementation(
        async id => [ATTACKER, VICTIM].find(s => s.merchantId === id) || null
    );
    markPaymentOrderCompleted.mockResolvedValue(true);
    completeDonationFromPayment.mockResolvedValue({ status: 'recorded' });
    IchibanCardStore.getIchibanCardByEventIdAndCardIndexAndStatus.mockResolvedValue(
        { id: 555, prize: { prizeName: 'A賞' } }
    );
    global.ichibanWebSocketServer = {
        broadcastToEvent: jest.fn(),
        broadcastToRoom: jest.fn(),
    };
});

afterEach(() => {
    delete global.ichibanWebSocketServer;
});

// ========================================================================
describe('PayUni notify：大型募資', () => {
    test('[重現] 用 ATTACKER 金鑰簽的回調，不可記到 VICTIM 的募資頁', async () => {
        getPaymentOrder.mockResolvedValue(lcfPendingOrderOf(VICTIM));
        getPaymentOrderForCallback.mockResolvedValue(lcfPendingOrderOf(VICTIM));

        // 金額刻意與訂單相同（500），證明光靠「店不同」就會被擋
        const forged = forgePayuniNotify(ATTACKER, {
            merTradeNo: VICTIM_TRADE_NO,
            amount: 500,
        });
        await handlePayuniNotify(forged, mockRes());

        // 修正前：completeDonationFromPayment 會被呼叫，訂單帶 ecpayConfigId=2（VICTIM），
        // 999999 元就記進 VICTIM 的募資頁
        expect(completeDonationFromPayment).not.toHaveBeenCalled();
        expect(markPaymentOrderCompleted).not.toHaveBeenCalled();
    });

    test('[對照] VICTIM 自己的金鑰簽的回調，正常入帳', async () => {
        getPaymentOrder.mockResolvedValue(lcfPendingOrderOf(VICTIM));
        getPaymentOrderForCallback.mockResolvedValue(lcfPendingOrderOf(VICTIM));

        const real = forgePayuniNotify(VICTIM, {
            merTradeNo: VICTIM_TRADE_NO,
            amount: 500,
        });
        await handlePayuniNotify(real, mockRes());

        expect(completeDonationFromPayment).toHaveBeenCalledTimes(1);
    });
});

// ========================================================================
describe('PayUni notify：一番賞', () => {
    test('[重現] 用 ATTACKER 金鑰簽的回調，不可打開 VICTIM 活動的卡片', async () => {
        getPaymentOrder.mockResolvedValue(ichibanOrderOf(VICTIM));

        const forged = forgePayuniNotify(ATTACKER, {
            merTradeNo: VICTIM_TRADE_NO,
            amount: 1,
        });
        await handlePayuniNotify(forged, mockRes());

        // 修正前：卡片被改成 OPENED、廣播中獎，攻擊者等於免費抽
        expect(
            IchibanCardStore.updateIchibanCardByIdAndStatus
        ).not.toHaveBeenCalled();
        expect(global.ichibanWebSocketServer.broadcastToEvent).not.toHaveBeenCalled();
    });

    test('[對照] VICTIM 自己的金鑰簽的回調，正常開卡', async () => {
        getPaymentOrder.mockResolvedValue(ichibanOrderOf(VICTIM));

        const real = forgePayuniNotify(VICTIM, {
            merTradeNo: VICTIM_TRADE_NO,
            amount: 100,
        });
        await handlePayuniNotify(real, mockRes());

        expect(
            IchibanCardStore.updateIchibanCardByIdAndStatus
        ).toHaveBeenCalledWith(555, expect.objectContaining({ status: expect.anything() }));
    });
});

// ========================================================================
describe('綠界 ecpay-success：大型募資', () => {
    const ECPAY_TRADE_NO = 'ECPAY1762750000000';

    function forgeEcpayReturn(store, amount) {
        const body = {
            MerchantID: store.merchantId,
            MerchantTradeNo: ECPAY_TRADE_NO,
            RtnCode: '1',
            TradeAmt: String(amount),
            CustomField1: 'x',
        };
        body.CheckMacValue = genCheckMacValue(body, store.hashKey, store.hashIV);
        return { body };
    }

    function ecpayLcfOrderOf(store) {
        return { ...lcfPendingOrderOf(store), kind: 'ecpay-donation' };
    }

    test('[重現] ATTACKER 的 MerchantID＋CheckMac 搭配 VICTIM 的單號，不可記到 VICTIM', async () => {
        getPaymentOrder.mockResolvedValue(ecpayLcfOrderOf(VICTIM));
        getPaymentOrderForCallback.mockResolvedValue(ecpayLcfOrderOf(VICTIM));

        // 金額與訂單相同，證明光靠「店不同」就會被擋
        await handleEcpaySuccess(forgeEcpayReturn(ATTACKER, 500), mockRes());

        expect(completeDonationFromPayment).not.toHaveBeenCalled();
    });

    test('[對照] VICTIM 自己的回調，正常入帳', async () => {
        getPaymentOrder.mockResolvedValue(ecpayLcfOrderOf(VICTIM));
        getPaymentOrderForCallback.mockResolvedValue(ecpayLcfOrderOf(VICTIM));

        await handleEcpaySuccess(forgeEcpayReturn(VICTIM, 500), mockRes());

        expect(completeDonationFromPayment).toHaveBeenCalledTimes(1);
    });
});

// ========================================================================
describe('根因：resolveEcpayConfigIdForLcfPayment', () => {
    test('[重現] 訂單的店與驗簽的店不一致時，不可直接採用訂單的店', async () => {
        const orderInfo = { ecpayConfigId: VICTIM.id };
        const verifiedRow = { ecpayConfigId: ATTACKER.id, merchantId: 'ATTACKER_PU' };

        // 修正前回傳 2（VICTIM）。修法可以是回 null（拒絕），
        // 也可以在更上游就擋掉；這裡只要求「不能回 VICTIM」
        await expect(
            resolveEcpayConfigIdForLcfPayment(orderInfo, verifiedRow)
        ).resolves.not.toBe(VICTIM.id);
    });
});

// ========================================================================
describe('單號可預測', () => {
    test('[重現] 同一毫秒建立的兩筆 PayUni 訂單，單號不可相同', () => {
        const spy = jest.spyOn(Date, 'now').mockReturnValue(1762750000000);
        try {
            const opts = { hashKey: VICTIM.payuniHashKey, hashIV: VICTIM.payuniHashIV };
            const order = { name: 'a', message: 'b', amount: 100 };
            const a = payuni.createPayment('VICTIM_PU', order, opts);
            const b = payuni.createPayment('VICTIM_PU', order, opts);

            // 修正前兩筆都是 PAYUNI1762750000000：
            // 1) 攻擊者知道建單時間就能猜到單號
            // 2) setPaymentOrder 用 upsert，同毫秒的兩位觀眾會互相覆蓋 pending 資料
            expect(a.merchantTradeNo).not.toBe(b.merchantTradeNo);
            expect(a.merchantTradeNo).not.toBe('PAYUNI1762750000000');
        } finally {
            spy.mockRestore();
        }
    });
});
