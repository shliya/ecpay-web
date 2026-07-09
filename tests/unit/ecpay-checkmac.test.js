/**
 * 綠界簽章與回調解析（純函式，不碰 DB）
 */
const crypto = require('crypto');
const {
    genCheckMacValue,
    verifyEcpayReturnCheckMac,
    parseUrlDonationCallback,
    parseDonationCallback,
} = require('../../server/lib/payment-providers/ecpay');

// aes-128-cbc 需 16 bytes key / iv
const HASH_KEY = '1234567890abcdef';
const HASH_IV = 'fedcba0987654321';
const CONFIG = { hashKey: HASH_KEY, hashIV: HASH_IV };

function signBody(body) {
    return {
        ...body,
        CheckMacValue: genCheckMacValue(body, HASH_KEY, HASH_IV),
    };
}

function encryptData(obj) {
    const plaintext = encodeURIComponent(JSON.stringify(obj));
    const cipher = crypto.createCipheriv('aes-128-cbc', HASH_KEY, HASH_IV);
    return Buffer.concat([
        cipher.update(plaintext, 'utf8'),
        cipher.final(),
    ]).toString('base64');
}

describe('genCheckMacValue', () => {
    test('相同輸入產生相同簽章、與參數順序無關', () => {
        const a = genCheckMacValue(
            { B: '2', A: '1' },
            HASH_KEY,
            HASH_IV
        );
        const b = genCheckMacValue(
            { A: '1', B: '2' },
            HASH_KEY,
            HASH_IV
        );
        expect(a).toBe(b);
        expect(a).toMatch(/^[0-9A-F]{64}$/);
    });

    test('不同金鑰產生不同簽章', () => {
        const params = { A: '1' };
        const a = genCheckMacValue(params, HASH_KEY, HASH_IV);
        const b = genCheckMacValue(params, 'xxxxxxxxxxxxxxxx', HASH_IV);
        expect(a).not.toBe(b);
    });
});

describe('verifyEcpayReturnCheckMac', () => {
    test('合法簽章通過驗證', () => {
        const body = signBody({ MerchantID: 'M1', TradeAmt: '100' });
        expect(verifyEcpayReturnCheckMac(body, CONFIG)).toBe(true);
    });

    test('竄改欄位後驗證失敗', () => {
        const body = signBody({ MerchantID: 'M1', TradeAmt: '100' });
        body.TradeAmt = '99999';
        expect(verifyEcpayReturnCheckMac(body, CONFIG)).toBe(false);
    });

    test('缺 CheckMacValue 或 config 時回 false', () => {
        expect(
            verifyEcpayReturnCheckMac({ MerchantID: 'M1' }, CONFIG)
        ).toBe(false);
        expect(verifyEcpayReturnCheckMac(null, CONFIG)).toBe(false);
        expect(verifyEcpayReturnCheckMac({ CheckMacValue: 'X' }, {})).toBe(
            false
        );
    });
});

describe('parseUrlDonationCallback', () => {
    const baseBody = {
        MerchantID: 'M1',
        RtnCode: '1',
        TradeAmt: '150',
        CustomField1: '小明',
        CustomField2: '加油',
    };

    test('合法回調解析成 donation row', () => {
        const row = parseUrlDonationCallback(signBody(baseBody), CONFIG);
        expect(row).toEqual(
            expect.objectContaining({
                merchantId: 'M1',
                name: '小明',
                cost: 150,
                message: '加油',
            })
        );
    });

    test('簽章錯誤回 null（不入帳）', () => {
        const body = signBody(baseBody);
        body.TradeAmt = '99999';
        expect(parseUrlDonationCallback(body, CONFIG)).toBeNull();
    });

    test('RtnCode 非 1 回 null', () => {
        const body = signBody({ ...baseBody, RtnCode: '0' });
        expect(parseUrlDonationCallback(body, CONFIG)).toBeNull();
    });

    test('金額非正數回 null', () => {
        const body = signBody({ ...baseBody, TradeAmt: '0' });
        expect(parseUrlDonationCallback(body, CONFIG)).toBeNull();
    });

    test('無 config 金鑰回 null', () => {
        expect(parseUrlDonationCallback(signBody(baseBody), null)).toBeNull();
        expect(parseUrlDonationCallback(signBody(baseBody), {})).toBeNull();
    });
});

describe('parseDonationCallback（加密 Data）', () => {
    test('正確金鑰可解密並解析', () => {
        const data = encryptData({
            RtnCode: 1,
            MerchantID: 'M1',
            OrderInfo: { TradeAmt: 200 },
            PatronName: '路人',
            PatronNote: 'hi',
        });
        const row = parseDonationCallback({ Data: data }, CONFIG);
        expect(row).toEqual(
            expect.objectContaining({
                merchantId: 'M1',
                name: '路人',
                cost: 200,
                message: 'hi',
            })
        );
    });

    test('錯誤金鑰解密失敗回 null', () => {
        const data = encryptData({
            RtnCode: 1,
            MerchantID: 'M1',
            OrderInfo: { TradeAmt: 200 },
        });
        const row = parseDonationCallback(
            { Data: data },
            { hashKey: 'wrongwrongwrong1', hashIV: HASH_IV }
        );
        expect(row).toBeNull();
    });

    test('RtnCode 非 1 回 null', () => {
        const data = encryptData({
            RtnCode: 0,
            MerchantID: 'M1',
            OrderInfo: { TradeAmt: 200 },
        });
        expect(parseDonationCallback({ Data: data }, CONFIG)).toBeNull();
    });
});
