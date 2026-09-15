/**
 * middleware/require-totp 與失敗計數器的接線測試。
 *
 * 重點不是 TOTP 演算法（那在 merchant-totp-verify.test.js），
 * 而是「猜錯夠多次之後，這支中介層真的會擋下來」——
 * 這是後台唯一會退回 TOTP 的入口，接線斷了等於防護不存在。
 */
process.env.TOTP_SESSION_SECRET =
    process.env.TOTP_SESSION_SECRET || 'test-session-secret-0123456789abcdef';
process.env.ENCRYPTION_KEY =
    process.env.ENCRYPTION_KEY || 'test-encryption-key-0123456789';
process.env.ENCRYPTION_KEY_SALT =
    process.env.ENCRYPTION_KEY_SALT || 'test-encryption-salt-0123456789';
process.env.NODE_ENV = 'test';

jest.mock('../../server/store/ecpay-config', () => ({
    getEcpayConfigByMerchantId: jest.fn(),
}));

const speakeasy = require('speakeasy');
const {
    getEcpayConfigByMerchantId,
} = require('../../server/store/ecpay-config');
const { encryptTotpSecret } = require('../../server/service/totp-crypto');
const requireTotp = require('../../server/middleware/require-totp');
const {
    MAX_FAILURES_PER_SOURCE,
    resetTotpAttempts,
} = require('../../server/lib/totp-attempt-limiter');

const MERCHANT_ID = 'M87654321';
const BASE32_SECRET = speakeasy.generateSecret({ length: 20 }).base32;

/** 產生一組「一定不等於當下有效碼」的驗證碼，避免測試偶發性通過 */
function wrongToken() {
    const valid = speakeasy.totp({
        secret: BASE32_SECRET,
        encoding: 'base32',
    });
    const shifted = (Number(valid) + 500000) % 1000000;
    return String(shifted).padStart(6, '0');
}

function createReq(token) {
    return {
        params: { merchantId: MERCHANT_ID },
        headers: token ? { 'x-totp-token': token } : {},
        ip: '203.0.113.7',
    };
}

function createRes() {
    const res = { statusCode: 200, body: null, headers: {} };
    res.status = jest.fn(code => {
        res.statusCode = code;
        return res;
    });
    res.json = jest.fn(payload => {
        res.body = payload;
        return res;
    });
    res.set = jest.fn((key, value) => {
        res.headers[key] = value;
        return res;
    });
    return res;
}

beforeEach(() => {
    resetTotpAttempts();
    getEcpayConfigByMerchantId.mockResolvedValue({
        merchantId: MERCHANT_ID,
        totpEnabled: true,
        totpSecret: encryptTotpSecret(BASE32_SECRET),
    });
});

describe('require-totp 猜碼鎖定', () => {
    test('連續猜錯達門檻後回 429 並帶 Retry-After', async () => {
        for (let i = 0; i < MAX_FAILURES_PER_SOURCE; i++) {
            const res = createRes();
            await requireTotp(createReq(wrongToken()), res, jest.fn());
            expect(res.statusCode).not.toBe(429);
        }

        const blocked = createRes();
        const next = jest.fn();
        await requireTotp(createReq(wrongToken()), blocked, next);

        expect(blocked.statusCode).toBe(429);
        expect(next).not.toHaveBeenCalled();
        expect(Number(blocked.headers['Retry-After'])).toBeGreaterThan(0);
    });

    test('被鎖定時不再查詢資料庫', async () => {
        for (let i = 0; i < MAX_FAILURES_PER_SOURCE; i++) {
            await requireTotp(createReq(wrongToken()), createRes(), jest.fn());
        }
        getEcpayConfigByMerchantId.mockClear();

        await requireTotp(createReq(wrongToken()), createRes(), jest.fn());

        expect(getEcpayConfigByMerchantId).not.toHaveBeenCalled();
    });

    test('沒帶驗證碼不計入猜測次數', async () => {
        for (let i = 0; i < MAX_FAILURES_PER_SOURCE * 3; i++) {
            const res = createRes();
            await requireTotp(createReq(null), res, jest.fn());
            expect(res.statusCode).toBe(401);
        }

        const res = createRes();
        await requireTotp(createReq(null), res, jest.fn());
        expect(res.statusCode).toBe(401);
    });

    test('商店未啟用 TOTP 不計入猜測次數', async () => {
        getEcpayConfigByMerchantId.mockResolvedValue({
            merchantId: MERCHANT_ID,
            totpEnabled: false,
        });

        for (let i = 0; i < MAX_FAILURES_PER_SOURCE * 3; i++) {
            const res = createRes();
            await requireTotp(createReq(wrongToken()), res, jest.fn());
            expect(res.statusCode).toBe(403);
        }
    });

    test('缺少 merchantId 仍然回 400', async () => {
        const res = createRes();
        await requireTotp(
            { params: {}, headers: {}, ip: '203.0.113.7' },
            res,
            jest.fn()
        );
        expect(res.statusCode).toBe(400);
    });
});
