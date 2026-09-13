/**
 * 商店所有權驗證：判斷一組 token 是否能證明持有者擁有該商店。
 *
 * 這段邏輯原本內嵌在 middleware/require-totp.js，因為綁定 Google 帳號時
 * 也需要同一套判斷，抽出來共用，避免兩處各寫一份安全性程式碼。
 *
 * 接受兩種 token：
 *   - 6 位數字：Authenticator 產生的 TOTP 驗證碼
 *   - HMAC session token（merchantId:expiresAt:簽章）：登入後發出的憑證
 */
const crypto = require('crypto');
const speakeasy = require('speakeasy');
const { getTotpSessionSecret } = require('./totp-session-secret');
const { decryptTotpSecret } = require('../service/totp-crypto');
const { isTestMerchantId } = require('./test-merchants');

const SESSION_SECRET = getTotpSessionSecret();

/** 驗證失敗的原因碼，呼叫端據此決定 HTTP 狀態 */
const VERIFY_REASON = {
    MISSING_TOKEN: 'missing_token',
    TOTP_NOT_ENABLED: 'totp_not_enabled',
    TOTP_SECRET_ERROR: 'totp_secret_error',
    INVALID_TOKEN: 'invalid_token',
};

function isNumericTotpToken(token) {
    return /^[0-9]{6}$/.test(String(token || '').trim());
}

function isValidTotpToken(secret, token) {
    if (!secret || !token) {
        return false;
    }
    return speakeasy.totp.verify({
        secret,
        encoding: 'base32',
        token: String(token).replace(/\s/g, ''),
        window: 1,
    });
}

/**
 * 驗證登入後發出的 HMAC session token。
 * 格式：`${merchantId}:${expiresAt}:${簽章}`
 */
function isValidSessionToken(token, merchantId) {
    if (!token || !merchantId) {
        return false;
    }

    const parts = String(token).trim().split(':');
    if (parts.length !== 3) {
        return false;
    }

    const [tokenMerchantId, expiresAtRaw, signature] = parts;
    if (String(tokenMerchantId).trim() !== String(merchantId).trim()) {
        return false;
    }

    const expiresAt = Number(expiresAtRaw);
    if (!Number.isFinite(expiresAt) || expiresAt < Date.now()) {
        return false;
    }

    const expectedSignature = crypto
        .createHmac('sha256', SESSION_SECRET)
        .update(`${tokenMerchantId}:${expiresAt}`)
        .digest('hex');

    try {
        const signatureBuffer = Buffer.from(String(signature).trim(), 'hex');
        const expectedBuffer = Buffer.from(expectedSignature, 'hex');
        if (signatureBuffer.length !== expectedBuffer.length) {
            return false;
        }
        return crypto.timingSafeEqual(signatureBuffer, expectedBuffer);
    } catch {
        return false;
    }
}

/**
 * 綜合判斷。config 由呼叫端先查好，本函式不碰資料庫。
 *
 * @param {{ config: object, merchantId: string, token: string }} params
 * @returns {{ ok: boolean, method: 'test'|'totp'|'session'|null, reason: string|null }}
 */
function verifyMerchantToken({ config, merchantId, token }) {
    const trimmedMerchantId = String(merchantId || '').trim();

    // 測試商店保留原本的後門：任意 6 位數字即通過
    if (isTestMerchantId(trimmedMerchantId) && isNumericTotpToken(token)) {
        return { ok: true, method: 'test', reason: null };
    }

    if (!config || !config.totpEnabled) {
        return {
            ok: false,
            method: null,
            reason: VERIFY_REASON.TOTP_NOT_ENABLED,
        };
    }

    if (!token) {
        return { ok: false, method: null, reason: VERIFY_REASON.MISSING_TOKEN };
    }

    if (isNumericTotpToken(token)) {
        const secret = decryptTotpSecret(config.totpSecret);
        if (!secret) {
            return {
                ok: false,
                method: null,
                reason: VERIFY_REASON.TOTP_SECRET_ERROR,
            };
        }
        return isValidTotpToken(secret, token)
            ? { ok: true, method: 'totp', reason: null }
            : { ok: false, method: null, reason: VERIFY_REASON.INVALID_TOKEN };
    }

    return isValidSessionToken(token, trimmedMerchantId)
        ? { ok: true, method: 'session', reason: null }
        : { ok: false, method: null, reason: VERIFY_REASON.INVALID_TOKEN };
}

module.exports = {
    VERIFY_REASON,
    isNumericTotpToken,
    isValidTotpToken,
    isValidSessionToken,
    verifyMerchantToken,
};
