/**
 * 將 ecpay_config.totpSecret 從 SHA256 派生 key 重加密為 PBKDF2（v2: 前綴）。
 *
 * 執行前請設定：
 * - ENCRYPTION_KEY（與原本相同，不可更換）
 * - ENCRYPTION_KEY_SALT（新亂數，至少 16 字元；之後不可改）
 *
 * 使用者不需重綁 TOTP：明文 secret 不變，僅密文格式／派生 key 變更。
 */
require('dotenv').config();

const {
    isV2Ciphertext,
    reencryptTotpSecretToV2,
} = require('../../service/totp-crypto');

/** @param {{ context: import('sequelize').Sequelize }} params */
async function up({ context: sequelize }) {
    if (!process.env.ENCRYPTION_KEY || process.env.ENCRYPTION_KEY.length < 16) {
        throw new Error(
            '002-reencrypt-totp-secrets-pbkdf2 需要 ENCRYPTION_KEY（≥16 字元）'
        );
    }
    const salt = String(process.env.ENCRYPTION_KEY_SALT || '').trim();
    if (!salt || salt.length < 16) {
        throw new Error(
            '002-reencrypt-totp-secrets-pbkdf2 需要 ENCRYPTION_KEY_SALT（≥16 字元）。' +
                '產生方式：node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"'
        );
    }

    const [rows] = await sequelize.query(`
        SELECT id, "totpSecret" AS "totpSecret"
        FROM ecpay_config
        WHERE "totpSecret" IS NOT NULL
          AND TRIM("totpSecret") <> ''
    `);

    let migrated = 0;
    let skipped = 0;

    for (const row of rows) {
        const id = row.id;
        const secret = row.totpSecret;
        if (isV2Ciphertext(secret)) {
            skipped += 1;
            continue;
        }

        const result = reencryptTotpSecretToV2(secret);
        if (!result || !result.migrated) {
            skipped += 1;
            continue;
        }

        await sequelize.query(
            `
            UPDATE ecpay_config
            SET "totpSecret" = :ciphertext
            WHERE id = :id
            `,
            {
                replacements: {
                    id,
                    ciphertext: result.ciphertext,
                },
            }
        );
        migrated += 1;
    }

    console.log(
        `[002-reencrypt-totp-secrets-pbkdf2] migrated=${migrated} skipped=${skipped} total=${rows.length}`
    );
}

/**
 * 還原為舊 SHA256 密文（僅緊急 rollback；需仍有相同 ENCRYPTION_KEY）。
 * @param {{ context: import('sequelize').Sequelize }} params
 */
async function down({ context: sequelize }) {
    const {
        decryptTotpSecret,
        getEncryptionKeyLegacySha256,
        isV2Ciphertext,
        CIPHER_VERSION_PREFIX,
    } = require('../../service/totp-crypto');
    const crypto = require('crypto');

    const ALGORITHM = 'aes-256-gcm';
    const IV_LENGTH = 16;
    const TAG_LENGTH = 16;

    function encryptLegacy(plaintext) {
        const key = getEncryptionKeyLegacySha256();
        const iv = crypto.randomBytes(IV_LENGTH);
        const cipher = crypto.createCipheriv(ALGORITHM, key, iv, {
            authTagLength: TAG_LENGTH,
        });
        const encrypted = Buffer.concat([
            cipher.update(plaintext, 'utf8'),
            cipher.final(),
        ]);
        const tag = cipher.getAuthTag();
        return Buffer.concat([iv, tag, encrypted]).toString('base64');
    }

    const [rows] = await sequelize.query(`
        SELECT id, "totpSecret" AS "totpSecret"
        FROM ecpay_config
        WHERE "totpSecret" IS NOT NULL
          AND TRIM("totpSecret") <> ''
    `);

    let restored = 0;
    for (const row of rows) {
        if (!isV2Ciphertext(row.totpSecret)) {
            continue;
        }
        const plain = decryptTotpSecret(row.totpSecret);
        if (plain == null) {
            throw new Error(
                `無法解密 id=${row.id} 的 v2 totpSecret，中止 down()`
            );
        }
        const legacy = encryptLegacy(plain);
        if (legacy.startsWith(CIPHER_VERSION_PREFIX)) {
            throw new Error('legacy 密文不應帶 v2 前綴');
        }
        await sequelize.query(
            `
            UPDATE ecpay_config
            SET "totpSecret" = :ciphertext
            WHERE id = :id
            `,
            { replacements: { id: row.id, ciphertext: legacy } }
        );
        restored += 1;
    }

    console.log(
        `[002-reencrypt-totp-secrets-pbkdf2] down restored=${restored}`
    );
}

module.exports = { up, down };
