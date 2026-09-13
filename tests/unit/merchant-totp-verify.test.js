/**
 * server/lib/merchant-totp-verify 的行為測試。
 *
 * 這段邏輯原先內嵌在 middleware/require-totp.js 且無測試覆蓋，
 * 抽出共用時一併補上，確保 Google 綁定與既有後台驗證吃的是同一套規則。
 */
process.env.TOTP_SESSION_SECRET =
    process.env.TOTP_SESSION_SECRET || 'test-session-secret-0123456789abcdef';
process.env.ENCRYPTION_KEY =
    process.env.ENCRYPTION_KEY || 'test-encryption-key-0123456789';
process.env.ENCRYPTION_KEY_SALT =
    process.env.ENCRYPTION_KEY_SALT || 'test-encryption-salt-0123456789';
process.env.NODE_ENV = 'test';

const crypto = require('crypto');
const speakeasy = require('speakeasy');
const { encryptTotpSecret } = require('../../server/service/totp-crypto');
const {
    VERIFY_REASON,
    verifyMerchantToken,
} = require('../../server/lib/merchant-totp-verify');

const MERCHANT_ID = 'M12345678';
const SESSION_SECRET = process.env.TOTP_SESSION_SECRET;

function makeSessionToken(merchantId, expiresAt) {
    const payload = `${merchantId}:${expiresAt}`;
    const signature = crypto
        .createHmac('sha256', SESSION_SECRET)
        .update(payload)
        .digest('hex');
    return `${payload}:${signature}`;
}

const base32Secret = speakeasy.generateSecret({ length: 20 }).base32;

function makeConfig(overrides = {}) {
    return {
        merchantId: MERCHANT_ID,
        totpEnabled: true,
        totpSecret: encryptTotpSecret(base32Secret),
        ...overrides,
    };
}

describe('verifyMerchantToken — HMAC session token', () => {
    test('有效的 session token 通過，method 為 session', () => {
        const token = makeSessionToken(MERCHANT_ID, Date.now() + 60000);
        const result = verifyMerchantToken({
            config: makeConfig(),
            merchantId: MERCHANT_ID,
            token,
        });
        expect(result).toEqual({ ok: true, method: 'session', reason: null });
    });

    test('token 內的 merchantId 與請求不符時拒絕', () => {
        const token = makeSessionToken('OTHER_MERCHANT', Date.now() + 60000);
        const result = verifyMerchantToken({
            config: makeConfig(),
            merchantId: MERCHANT_ID,
            token,
        });
        expect(result.ok).toBe(false);
        expect(result.reason).toBe(VERIFY_REASON.INVALID_TOKEN);
    });

    test('已過期的 token 拒絕', () => {
        const token = makeSessionToken(MERCHANT_ID, Date.now() - 1000);
        const result = verifyMerchantToken({
            config: makeConfig(),
            merchantId: MERCHANT_ID,
            token,
        });
        expect(result.ok).toBe(false);
    });

    test('簽章被竄改時拒絕', () => {
        const valid = makeSessionToken(MERCHANT_ID, Date.now() + 60000);
        const tampered =
            valid.slice(0, -2) + (valid.endsWith('aa') ? 'bb' : 'aa');
        const result = verifyMerchantToken({
            config: makeConfig(),
            merchantId: MERCHANT_ID,
            token: tampered,
        });
        expect(result.ok).toBe(false);
    });

    test('格式不正確（欄位數不對）時拒絕', () => {
        const result = verifyMerchantToken({
            config: makeConfig(),
            merchantId: MERCHANT_ID,
            token: 'not-a-valid-token',
        });
        expect(result.ok).toBe(false);
    });
});

describe('verifyMerchantToken — TOTP 驗證碼', () => {
    test('正確的 6 位數驗證碼通過，method 為 totp', () => {
        const token = speakeasy.totp({
            secret: base32Secret,
            encoding: 'base32',
        });
        const result = verifyMerchantToken({
            config: makeConfig(),
            merchantId: MERCHANT_ID,
            token,
        });
        expect(result).toEqual({ ok: true, method: 'totp', reason: null });
    });

    test('錯誤的 6 位數驗證碼拒絕', () => {
        const correct = speakeasy.totp({
            secret: base32Secret,
            encoding: 'base32',
        });
        const wrong = correct === '000000' ? '111111' : '000000';
        const result = verifyMerchantToken({
            config: makeConfig(),
            merchantId: MERCHANT_ID,
            token: wrong,
        });
        expect(result.ok).toBe(false);
        expect(result.reason).toBe(VERIFY_REASON.INVALID_TOKEN);
    });

    test('totpSecret 解不開時回報設定異常', () => {
        const result = verifyMerchantToken({
            config: makeConfig({ totpSecret: 'not-decryptable' }),
            merchantId: MERCHANT_ID,
            token: '123456',
        });
        expect(result.ok).toBe(false);
        expect(result.reason).toBe(VERIFY_REASON.TOTP_SECRET_ERROR);
    });
});

describe('verifyMerchantToken — 前置條件', () => {
    test('商店尚未啟用 TOTP 時拒絕', () => {
        const result = verifyMerchantToken({
            config: makeConfig({ totpEnabled: false }),
            merchantId: MERCHANT_ID,
            token: makeSessionToken(MERCHANT_ID, Date.now() + 60000),
        });
        expect(result.ok).toBe(false);
        expect(result.reason).toBe(VERIFY_REASON.TOTP_NOT_ENABLED);
    });

    test('config 不存在時拒絕', () => {
        const result = verifyMerchantToken({
            config: null,
            merchantId: MERCHANT_ID,
            token: makeSessionToken(MERCHANT_ID, Date.now() + 60000),
        });
        expect(result.ok).toBe(false);
        expect(result.reason).toBe(VERIFY_REASON.TOTP_NOT_ENABLED);
    });

    test('沒有帶 token 時回報缺少 token', () => {
        const result = verifyMerchantToken({
            config: makeConfig(),
            merchantId: MERCHANT_ID,
            token: undefined,
        });
        expect(result.ok).toBe(false);
        expect(result.reason).toBe(VERIFY_REASON.MISSING_TOKEN);
    });
});

describe('verifyMerchantToken — 測試商店繞過', () => {
    test('非 production 下，測試商店任意 6 位數字皆通過', () => {
        const result = verifyMerchantToken({
            config: makeConfig({ totpEnabled: false }),
            merchantId: '3002599',
            token: '000000',
        });
        expect(result).toEqual({ ok: true, method: 'test', reason: null });
    });

    test('測試商店的非數字 token 不走繞過', () => {
        const result = verifyMerchantToken({
            config: makeConfig({ totpEnabled: false }),
            merchantId: '3002599',
            token: 'abcdef',
        });
        expect(result.ok).toBe(false);
    });
});
