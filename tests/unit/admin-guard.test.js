/**
 * server/lib/admin-guard 的行為測試。
 *
 * 這支決定「誰能解除商店綁定」，是目前權限最高的一組 API，
 * 因此邊界條件（未設定名單、大小寫、非名單者）都要鎖住，
 * 避免日後有人為了方便把 fail-closed 改成 fail-open。
 */
process.env.NODE_ENV = 'test';

const GUARD_PATH = '../../server/lib/admin-guard';

/** 每次都以指定的名單重新載入模組，避免測試之間互相污染 */
function loadGuard(adminEmails) {
    jest.resetModules();
    if (adminEmails === undefined) {
        delete process.env.ADMIN_EMAILS;
    } else {
        process.env.ADMIN_EMAILS = adminEmails;
    }
    return require(GUARD_PATH);
}

describe('isAdminEmail', () => {
    it('未設定 ADMIN_EMAILS 時一律拒絕（fail closed）', () => {
        const { isAdminEmail } = loadGuard(undefined);
        expect(isAdminEmail('anyone@example.com')).toBe(false);
    });

    it('ADMIN_EMAILS 為空字串時一律拒絕', () => {
        const { isAdminEmail } = loadGuard('');
        expect(isAdminEmail('anyone@example.com')).toBe(false);
    });

    it('名單內的 email 通過，且忽略大小寫與前後空白', () => {
        const { isAdminEmail } = loadGuard(
            '  Owner@Example.com , second@example.com '
        );
        expect(isAdminEmail('owner@example.com')).toBe(true);
        expect(isAdminEmail('OWNER@EXAMPLE.COM')).toBe(true);
        expect(isAdminEmail('  owner@example.com  ')).toBe(true);
        expect(isAdminEmail('second@example.com')).toBe(true);
    });

    it('不在名單內的 email 一律拒絕', () => {
        const { isAdminEmail } = loadGuard('owner@example.com');
        expect(isAdminEmail('attacker@evil.com')).toBe(false);
    });

    it('空值與非字串一律拒絕', () => {
        const { isAdminEmail } = loadGuard('owner@example.com');
        expect(isAdminEmail('')).toBe(false);
        expect(isAdminEmail(null)).toBe(false);
        expect(isAdminEmail(undefined)).toBe(false);
    });

    it('不會因為部分比對而誤判', () => {
        const { isAdminEmail } = loadGuard('owner@example.com');
        expect(isAdminEmail('owner@example.com.evil.com')).toBe(false);
        expect(isAdminEmail('notowner@example.com')).toBe(false);
    });
});

describe('getAdminEmails', () => {
    it('回傳正規化後的名單', () => {
        const { getAdminEmails } = loadGuard(' A@x.com ,, B@y.com ');
        expect(getAdminEmails()).toEqual(['a@x.com', 'b@y.com']);
    });
});
