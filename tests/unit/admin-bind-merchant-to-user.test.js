/**
 * POST /api/v1/admin/merchant-members —— 管理者指定商店擁有者。
 *
 * 這支是孤兒商店（解綁後沒有 TOTP、沒人能登入）的唯一救援路徑，
 * 所以重點放在「該擋的有沒有擋住」：不能覆蓋現任擁有者、
 * 對象必須真的存在、失敗也要留下稽核。
 */
jest.mock('../../server/store/ecpay-config', () => ({
    getEcpayConfigByMerchantId: jest.fn(),
}));
jest.mock('../../server/store/auth-user', () => ({
    findAuthUserByEmail: jest.fn(),
}));
jest.mock('../../server/store/merchant-member', () => ({
    BIND_ERROR: {
        MERCHANT_NOT_FOUND: 'merchant_not_found',
        ALREADY_BOUND_BY_OTHER: 'already_bound_by_other',
        USER_HAS_OTHER_MERCHANT: 'user_has_other_merchant',
    },
    bindMerchant: jest.fn(),
    getActiveMemberByMerchantId: jest.fn(),
    recordBindAudit: jest.fn(),
}));

const {
    getEcpayConfigByMerchantId,
} = require('../../server/store/ecpay-config');
const { findAuthUserByEmail } = require('../../server/store/auth-user');
const {
    bindMerchant,
    getActiveMemberByMerchantId,
    recordBindAudit,
} = require('../../server/store/merchant-member');
const handler = require('../../server/route-handlers/admin/handle-bind-merchant-to-user');

const MERCHANT_ID = 'M12345678';
const TARGET_EMAIL = 'streamer@example.com';

function createReq(body = {}) {
    return {
        body: { merchantId: MERCHANT_ID, email: TARGET_EMAIL, ...body },
        headers: { 'user-agent': 'jest' },
        ip: '203.0.113.9',
        adminUser: { email: 'admin@example.com' },
    };
}

function createRes() {
    const res = { statusCode: 200, body: null };
    res.status = jest.fn(code => {
        res.statusCode = code;
        return res;
    });
    res.json = jest.fn(payload => {
        res.body = payload;
        return res;
    });
    return res;
}

beforeEach(() => {
    getEcpayConfigByMerchantId.mockResolvedValue({
        merchantId: MERCHANT_ID,
        displayName: '鼠鼠小舖',
        totpEnabled: false,
    });
    getActiveMemberByMerchantId.mockResolvedValue(null);
    findAuthUserByEmail.mockResolvedValue({
        id: 'user_abc',
        email: TARGET_EMAIL,
        name: '實況主',
        emailVerified: true,
    });
    bindMerchant.mockResolvedValue({ ok: true, created: true });
    recordBindAudit.mockResolvedValue(undefined);
});

describe('成功路徑', () => {
    test('綁定孤兒商店並回傳對象資訊', async () => {
        const res = createRes();
        await handler(createReq(), res);

        expect(bindMerchant).toHaveBeenCalledWith({
            userId: 'user_abc',
            merchantId: MERCHANT_ID,
            boundVia: 'admin',
        });
        expect(res.statusCode).toBe(201);
        expect(res.body.success).toBe(true);
        expect(res.body.user.email).toBe(TARGET_EMAIL);
        expect(res.body.totpEnabled).toBe(false);
    });

    test('留下標記為 admin 的成功稽核，並記錄是哪位管理者', async () => {
        await handler(createReq(), createRes());

        const entry = recordBindAudit.mock.calls[0][0];
        expect(entry.action).toBe('bind');
        expect(entry.method).toBe('admin');
        expect(entry.result).toBe('success');
        expect(entry.reason).toContain('admin@example.com');
    });

    test('不會去動商店的 TOTP 狀態', async () => {
        getEcpayConfigByMerchantId.mockResolvedValue({
            merchantId: MERCHANT_ID,
            totpEnabled: true,
        });
        const res = createRes();

        await handler(createReq(), res);

        // 只回報現況，救援路徑不該把原擁有者的退路關掉
        expect(res.body.totpEnabled).toBe(true);
    });
});

describe('該擋下來的情況', () => {
    test('缺少參數回 400', async () => {
        const res = createRes();
        await handler(createReq({ email: '' }), res);

        expect(res.statusCode).toBe(400);
        expect(bindMerchant).not.toHaveBeenCalled();
    });

    test('商店不存在回 404', async () => {
        getEcpayConfigByMerchantId.mockResolvedValue(null);
        const res = createRes();

        await handler(createReq(), res);

        expect(res.statusCode).toBe(404);
        expect(bindMerchant).not.toHaveBeenCalled();
    });

    test('商店已有擁有者時回 409，不覆蓋', async () => {
        getActiveMemberByMerchantId.mockResolvedValue({
            userId: 'user_existing',
        });
        const res = createRes();

        await handler(createReq(), res);

        expect(res.statusCode).toBe(409);
        expect(res.body.boundUserId).toBe('user_existing');
        expect(bindMerchant).not.toHaveBeenCalled();
    });

    test('對象從未登入過回 404', async () => {
        findAuthUserByEmail.mockResolvedValue(null);
        const res = createRes();

        await handler(createReq(), res);

        expect(res.statusCode).toBe(404);
        expect(res.body.error).toContain('Google 登入');
        expect(bindMerchant).not.toHaveBeenCalled();
    });

    test('對象已綁其他商店回 409，且留下失敗稽核', async () => {
        bindMerchant.mockResolvedValue({
            ok: false,
            code: 'user_has_other_merchant',
        });
        const res = createRes();

        await handler(createReq(), res);

        expect(res.statusCode).toBe(409);
        expect(recordBindAudit.mock.calls[0][0].result).toBe('failed');
    });

    test('例外時回 500 並留下稽核', async () => {
        bindMerchant.mockRejectedValue(new Error('db down'));
        const res = createRes();

        await handler(createReq(), res);

        expect(res.statusCode).toBe(500);
        const entry = recordBindAudit.mock.calls.at(-1)[0];
        expect(entry.result).toBe('failed');
        expect(entry.reason).toContain('server_error');
    });
});
