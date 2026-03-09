const crypto = require('crypto');

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const TAG_LENGTH = 16;
const KEY_LENGTH = 32;

function getEncryptionKey() {
    const key = process.env.ENCRYPTION_KEY;
    if (!key || key.length < 16) {
        throw new Error('ENCRYPTION_KEY 環境變數需至少 16 字元');
    }
    return crypto.createHash('sha256').update(key).digest();
}

function encryptTotpSecret(plaintext) {
    const key = getEncryptionKey();
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

function decryptTotpSecret(ciphertext) {
    if (!ciphertext) return null;
    const key = getEncryptionKey();
    const buf = Buffer.from(ciphertext, 'base64');
    if (buf.length < IV_LENGTH + TAG_LENGTH) return null;
    const iv = buf.subarray(0, IV_LENGTH);
    const tag = buf.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH);
    const encrypted = buf.subarray(IV_LENGTH + TAG_LENGTH);
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv, {
        authTagLength: TAG_LENGTH,
    });
    decipher.setAuthTag(tag);
    return decipher.update(encrypted) + decipher.final('utf8');
}

module.exports = {
    encryptTotpSecret,
    decryptTotpSecret,
};
