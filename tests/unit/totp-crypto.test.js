/**
 * totp-crypto：PBKDF2 key 派生與舊 SHA256 密文相容
 */
describe('totp-crypto', () => {
    const ORIGINAL_KEY = process.env.ENCRYPTION_KEY;
    const ORIGINAL_SALT = process.env.ENCRYPTION_KEY_SALT;

    let totpCrypto;

    beforeEach(() => {
        jest.resetModules();
        process.env.ENCRYPTION_KEY = 'test-encryption-key-32chars!!';
        process.env.ENCRYPTION_KEY_SALT =
            'a1b2c3d4e5f6789012345678abcdef0123456789abcdef01';
        totpCrypto = require('../../server/service/totp-crypto');
        totpCrypto.clearEncryptionKeyCache();
    });

    afterAll(() => {
        if (ORIGINAL_KEY === undefined) {
            delete process.env.ENCRYPTION_KEY;
        } else {
            process.env.ENCRYPTION_KEY = ORIGINAL_KEY;
        }
        if (ORIGINAL_SALT === undefined) {
            delete process.env.ENCRYPTION_KEY_SALT;
        } else {
            process.env.ENCRYPTION_KEY_SALT = ORIGINAL_SALT;
        }
    });

    test('缺少 ENCRYPTION_KEY_SALT 時 getEncryptionKey 拋錯', () => {
        delete process.env.ENCRYPTION_KEY_SALT;
        totpCrypto.clearEncryptionKeyCache();
        expect(() => totpCrypto.getEncryptionKey()).toThrow(
            /ENCRYPTION_KEY_SALT/
        );
    });

    test('v2 加密後可解密，且帶 v2: 前綴', () => {
        const plain = 'JBSWY3DPEHPK3PXP';
        const cipher = totpCrypto.encryptTotpSecret(plain);
        expect(cipher.startsWith('v2:')).toBe(true);
        expect(totpCrypto.decryptTotpSecret(cipher)).toBe(plain);
    });

    test('舊 SHA256 密文仍可解密（遷移前相容）', () => {
        const crypto = require('crypto');
        const plain = 'OLDSECRETBASE32VALUE';
        const key = totpCrypto.getEncryptionKeyLegacySha256();
        const iv = crypto.randomBytes(16);
        const cipher = crypto.createCipheriv('aes-256-gcm', key, iv, {
            authTagLength: 16,
        });
        const encrypted = Buffer.concat([
            cipher.update(plain, 'utf8'),
            cipher.final(),
        ]);
        const tag = cipher.getAuthTag();
        const legacy = Buffer.concat([iv, tag, encrypted]).toString('base64');

        expect(totpCrypto.isV2Ciphertext(legacy)).toBe(false);
        expect(totpCrypto.decryptTotpSecret(legacy)).toBe(plain);
    });

    test('reencryptTotpSecretToV2 把舊密文升級為 v2', () => {
        const crypto = require('crypto');
        const plain = 'MIGRATEME123456';
        const key = totpCrypto.getEncryptionKeyLegacySha256();
        const iv = crypto.randomBytes(16);
        const cipher = crypto.createCipheriv('aes-256-gcm', key, iv, {
            authTagLength: 16,
        });
        const encrypted = Buffer.concat([
            cipher.update(plain, 'utf8'),
            cipher.final(),
        ]);
        const tag = cipher.getAuthTag();
        const legacy = Buffer.concat([iv, tag, encrypted]).toString('base64');

        const result = totpCrypto.reencryptTotpSecretToV2(legacy);
        expect(result.migrated).toBe(true);
        expect(result.ciphertext.startsWith('v2:')).toBe(true);
        expect(totpCrypto.decryptTotpSecret(result.ciphertext)).toBe(plain);

        const again = totpCrypto.reencryptTotpSecretToV2(result.ciphertext);
        expect(again.migrated).toBe(false);
    });
});
