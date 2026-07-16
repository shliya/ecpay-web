const { safeEqualString } = require('../../server/lib/safe-equal');
const {
    assertRegistrationAllowed,
} = require('../../server/lib/registration-guard');
const {
    verifyMerchantKeyOwnership,
} = require('../../server/lib/merchant-ownership');
const {
    isTestMerchantId,
} = require('../../server/lib/test-merchants');

describe('safeEqualString', () => {
    test('相同字串為 true', () => {
        expect(safeEqualString('abc', 'abc')).toBe(true);
    });
    test('不同字串為 false', () => {
        expect(safeEqualString('abc', 'abd')).toBe(false);
        expect(safeEqualString('abc', 'ab')).toBe(false);
        expect(safeEqualString('', '')).toBe(false);
    });
});

describe('assertRegistrationAllowed', () => {
    const originalEnv = { ...process.env };

    afterEach(() => {
        process.env.NODE_ENV = originalEnv.NODE_ENV;
        if (originalEnv.REGISTRATION_SECRET === undefined) {
            delete process.env.REGISTRATION_SECRET;
        } else {
            process.env.REGISTRATION_SECRET = originalEnv.REGISTRATION_SECRET;
        }
    });

    test('production 未設 REGISTRATION_SECRET → 拒絕', () => {
        process.env.NODE_ENV = 'production';
        delete process.env.REGISTRATION_SECRET;
        const r = assertRegistrationAllowed({ headers: {}, body: {} });
        expect(r.ok).toBe(false);
        expect(r.status).toBe(403);
    });

    test('production 金鑰正確 → 通過', () => {
        process.env.NODE_ENV = 'production';
        process.env.REGISTRATION_SECRET = 'registration-secret-16';
        const r = assertRegistrationAllowed({
            headers: { 'x-registration-secret': 'registration-secret-16' },
            body: {},
        });
        expect(r.ok).toBe(true);
    });

    test('production 金鑰錯誤 → 拒絕', () => {
        process.env.NODE_ENV = 'production';
        process.env.REGISTRATION_SECRET = 'registration-secret-16';
        const r = assertRegistrationAllowed({
            headers: {},
            body: { registrationSecret: 'wrong-secret-xxxxx' },
        });
        expect(r.ok).toBe(false);
    });

    test('非 production 未設 secret → 允許（開發用）', () => {
        process.env.NODE_ENV = 'local';
        delete process.env.REGISTRATION_SECRET;
        expect(assertRegistrationAllowed({ headers: {}, body: {} }).ok).toBe(
            true
        );
    });
});

describe('verifyMerchantKeyOwnership', () => {
    test('綠界 hashKey 相符', () => {
        expect(
            verifyMerchantKeyOwnership(
                { hashKey: 'ecpay-key', payuniHashKey: null },
                { hashKey: 'ecpay-key' }
            )
        ).toBe(true);
    });

    test('錯誤 hashKey', () => {
        expect(
            verifyMerchantKeyOwnership(
                { hashKey: 'ecpay-key' },
                { hashKey: 'wrong' }
            )
        ).toBe(false);
    });

    test('PayUni hashKey 相符', () => {
        expect(
            verifyMerchantKeyOwnership(
                { hashKey: null, payuniHashKey: 'payuni-key' },
                { payuniHashKey: 'payuni-key' }
            )
        ).toBe(true);
    });
});

describe('test-merchants bypass', () => {
    const originalEnv = { ...process.env };

    afterEach(() => {
        process.env.NODE_ENV = originalEnv.NODE_ENV;
        if (originalEnv.ALLOW_TEST_MERCHANT_TOTP_BYPASS === undefined) {
            delete process.env.ALLOW_TEST_MERCHANT_TOTP_BYPASS;
        } else {
            process.env.ALLOW_TEST_MERCHANT_TOTP_BYPASS =
                originalEnv.ALLOW_TEST_MERCHANT_TOTP_BYPASS;
        }
        jest.resetModules();
    });

    test('production 預設關閉 bypass', () => {
        jest.resetModules();
        process.env.NODE_ENV = 'production';
        delete process.env.ALLOW_TEST_MERCHANT_TOTP_BYPASS;
        const mod = require('../../server/lib/test-merchants');
        expect(mod.isTestMerchantBypassEnabled()).toBe(false);
        expect(mod.isTestMerchantId('3002599')).toBe(false);
    });

    test('非 production 可 bypass', () => {
        jest.resetModules();
        process.env.NODE_ENV = 'local';
        delete process.env.ALLOW_TEST_MERCHANT_TOTP_BYPASS;
        const mod = require('../../server/lib/test-merchants');
        expect(mod.isTestMerchantId('3002599')).toBe(true);
    });
});
