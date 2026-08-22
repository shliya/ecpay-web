const crypto = require('crypto');

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const TAG_LENGTH = 16;
const KEY_LENGTH = 32;
const PBKDF2_ITERATIONS = 210000;
const CIPHER_VERSION_PREFIX = 'v2:';

let cachedPbkdf2Key = null;
let cachedLegacyKey = null;

function getPassphrase() {
    const key = process.env.ENCRYPTION_KEY;
    if (!key || key.length < 16) {
        throw new Error('ENCRYPTION_KEY 環境變數需至少 16 字元');
    }
    return key;
}

function getPbkdf2Salt() {
    const salt = String(process.env.ENCRYPTION_KEY_SALT || '').trim();
    if (!salt || salt.length < 16) {
        throw new Error(
            'ENCRYPTION_KEY_SALT 環境變數需至少 16 字元（建議 crypto.randomBytes(32).toString("hex")）'
        );
    }
    return salt;
}

/**
 * 舊版：單次 SHA256（僅供解密遷移／相容）
 * @returns {Buffer}
 */
function getEncryptionKeyLegacySha256() {
    if (cachedLegacyKey) {
        return cachedLegacyKey;
    }
    cachedLegacyKey = crypto.createHash('sha256').update(getPassphrase()).digest();
    return cachedLegacyKey;
}

/**
 * 新版：PBKDF2 從 passphrase + salt 導出 AES key
 * @returns {Buffer}
 */
function getEncryptionKey() {
    if (cachedPbkdf2Key) {
        return cachedPbkdf2Key;
    }
    cachedPbkdf2Key = crypto.pbkdf2Sync(
        getPassphrase(),
        getPbkdf2Salt(),
        PBKDF2_ITERATIONS,
        KEY_LENGTH,
        'sha256'
    );
    return cachedPbkdf2Key;
}

/** 測試用：清除 key cache */
function clearEncryptionKeyCache() {
    cachedPbkdf2Key = null;
    cachedLegacyKey = null;
}

function packCiphertext(iv, tag, encrypted) {
    return Buffer.concat([iv, tag, encrypted]).toString('base64');
}

function unpackCiphertext(base64Body) {
    const buf = Buffer.from(base64Body, 'base64');
    if (buf.length < IV_LENGTH + TAG_LENGTH) {
        return null;
    }
    return {
        iv: buf.subarray(0, IV_LENGTH),
        tag: buf.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH),
        encrypted: buf.subarray(IV_LENGTH + TAG_LENGTH),
    };
}

function encryptWithKey(plaintext, key) {
    const iv = crypto.randomBytes(IV_LENGTH);
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv, {
        authTagLength: TAG_LENGTH,
    });
    const encrypted = Buffer.concat([
        cipher.update(plaintext, 'utf8'),
        cipher.final(),
    ]);
    const tag = cipher.getAuthTag();
    return packCiphertext(iv, tag, encrypted);
}

function decryptWithKey(base64Body, key) {
    const parts = unpackCiphertext(base64Body);
    if (!parts) {
        return null;
    }
    const decipher = crypto.createDecipheriv(ALGORITHM, key, parts.iv, {
        authTagLength: TAG_LENGTH,
    });
    decipher.setAuthTag(parts.tag);
    return Buffer.concat([
        decipher.update(parts.encrypted),
        decipher.final(),
    ]).toString('utf8');
}

function isV2Ciphertext(ciphertext) {
    return (
        typeof ciphertext === 'string' &&
        ciphertext.startsWith(CIPHER_VERSION_PREFIX)
    );
}

/**
 * 加密 TOTP secret（一律 PBKDF2 key，密文前綴 v2:）
 * @param {string} plaintext
 * @returns {string}
 */
function encryptTotpSecret(plaintext) {
    const body = encryptWithKey(plaintext, getEncryptionKey());
    return CIPHER_VERSION_PREFIX + body;
}

/**
 * 解密 TOTP secret。
 * - v2: → PBKDF2 key
 * - 無前綴 → 舊 SHA256 key（遷移前／尚未跑 migration）
 * @param {string|null|undefined} ciphertext
 * @returns {string|null}
 */
function decryptTotpSecret(ciphertext) {
    if (!ciphertext) {
        return null;
    }
    try {
        if (isV2Ciphertext(ciphertext)) {
            return decryptWithKey(
                ciphertext.slice(CIPHER_VERSION_PREFIX.length),
                getEncryptionKey()
            );
        }
        return decryptWithKey(ciphertext, getEncryptionKeyLegacySha256());
    } catch {
        return null;
    }
}

/**
 * 若仍是舊格式，改以 PBKDF2 重加密；已是 v2 則原樣回傳。
 * @param {string} ciphertext
 * @returns {{ ciphertext: string, migrated: boolean }|null}
 */
function reencryptTotpSecretToV2(ciphertext) {
    if (!ciphertext) {
        return null;
    }
    if (isV2Ciphertext(ciphertext)) {
        return { ciphertext, migrated: false };
    }
    const plain = decryptWithKey(ciphertext, getEncryptionKeyLegacySha256());
    if (plain == null) {
        throw new Error('無法以舊 key 解密 totpSecret，請確認 ENCRYPTION_KEY');
    }
    return {
        ciphertext: encryptTotpSecret(plain),
        migrated: true,
    };
}
 
module.exports = {
    ALGORITHM,
    PBKDF2_ITERATIONS,
    CIPHER_VERSION_PREFIX,
    getEncryptionKey,
    getEncryptionKeyLegacySha256,
    clearEncryptionKeyCache,
    encryptTotpSecret,
    decryptTotpSecret,
    isV2Ciphertext,
    reencryptTotpSecretToV2,
};
