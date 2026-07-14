describe('totp-session-secret', () => {
    const original = process.env.TOTP_SESSION_SECRET;

    afterEach(() => {
        if (original === undefined) {
            delete process.env.TOTP_SESSION_SECRET;
        } else {
            process.env.TOTP_SESSION_SECRET = original;
        }
        jest.resetModules();
    });

    test('缺少 TOTP_SESSION_SECRET 時拋錯', () => {
        delete process.env.TOTP_SESSION_SECRET;
        const { getTotpSessionSecret } = require('../../server/lib/totp-session-secret');
        expect(() => getTotpSessionSecret()).toThrow(
            'TOTP_SESSION_SECRET 環境變數需至少 16 字元'
        );
    });

    test('長度不足時拋錯', () => {
        process.env.TOTP_SESSION_SECRET = 'short';
        const { getTotpSessionSecret } = require('../../server/lib/totp-session-secret');
        expect(() => getTotpSessionSecret()).toThrow(
            'TOTP_SESSION_SECRET 環境變數需至少 16 字元'
        );
    });

    test('有效 secret 可通過', () => {
        process.env.TOTP_SESSION_SECRET =
            '92e5db06ae106720623cd8ede7e21db55124b99a29f80a6a55c94e864dc1423f';
        const { getTotpSessionSecret } = require('../../server/lib/totp-session-secret');
        expect(getTotpSessionSecret()).toBe(process.env.TOTP_SESSION_SECRET);
    });
});
