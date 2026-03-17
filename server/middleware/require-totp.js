const crypto = require('crypto');
const speakeasy = require('speakeasy');
const { getEcpayConfigByMerchantId } = require('../store/ecpay-config');
const { decryptTotpSecret } = require('../service/totp-crypto');
const { isTestMerchantId } = require('../lib/test-merchants');

const ONE_DAY_MS = 24 * 60 * 60 * 1000;
const SESSION_SECRET =
    process.env.TOTP_SESSION_SECRET || 'CHANGE_THIS_TOTP_SESSION_SECRET';

function extractMerchantId(req) {
    return req.params.merchantId || req.body?.merchantId || null;
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

function isNumericTotpToken(token) {
    const numericToken = String(token).trim();
    return /^[0-9]{6}$/.test(numericToken);
}

function isValidSessionToken(token, merchantId) {
    if (!token || !merchantId) {
        return false;
    }

    const tokenString = String(token).trim();
    const parts = tokenString.split(':');
    if (parts.length !== 3) {
        return false;
    }

    const [tokenMerchantId, expiresAtRaw, signature] = parts;
    const trimmedMerchantId = String(merchantId).trim();

    if (String(tokenMerchantId).trim() !== trimmedMerchantId) {
        return false;
    }

    const expiresAt = Number(expiresAtRaw);
    if (!Number.isFinite(expiresAt)) {
        return false;
    }

    if (expiresAt < Date.now()) {
        return false;
    }

    const payload = `${tokenMerchantId}:${expiresAt}`;
    const expectedSignature = crypto
        .createHmac('sha256', SESSION_SECRET)
        .update(payload)
        .digest('hex');

    try {
        const signatureBuffer = Buffer.from(String(signature).trim(), 'hex');
        const expectedBuffer = Buffer.from(expectedSignature, 'hex');

        if (signatureBuffer.length !== expectedBuffer.length) {
            return false;
        }

        if (!crypto.timingSafeEqual(signatureBuffer, expectedBuffer)) {
            return false;
        }
    } catch {
        return false;
    }

    return true;
}

async function requireTotp(req, res, next) {
    try {
        const merchantId = extractMerchantId(req);
        if (!merchantId) {
            res.status(400).json({ error: '缺少 merchantId' });
            return;
        }

        const trimmedMerchantId = String(merchantId).trim();
        const config = await getEcpayConfigByMerchantId(trimmedMerchantId);
        if (!config) {
            res.status(404).json({ error: '商店不存在' });
            return;
        }

        if (!config.totpEnabled) {
            next();
            return;
        }

        const totpToken = req.headers['x-totp-token'];
        if (!totpToken) {
            res.status(401).json({ error: '需要 TOTP 驗證碼' });
            return;
        }

        if (isTestMerchantId(trimmedMerchantId)) {
            if (isNumericTotpToken(totpToken)) {
                next();
                return;
            }
        }

        if (isNumericTotpToken(totpToken)) {
            const secret = decryptTotpSecret(config.totpSecret);
            if (!secret) {
                res.status(500).json({ error: 'TOTP 設定異常' });
                return;
            }

            if (!isValidTotpToken(secret, totpToken)) {
                res.status(401).json({ error: 'TOTP 驗證碼錯誤或已過期' });
                return;
            }
        } else if (!isValidSessionToken(totpToken, trimmedMerchantId)) {
            res.status(401).json({ error: 'TOTP 驗證碼錯誤或已過期' });
            return;
        }

        next();
    } catch (error) {
        console.error('[require-totp] 驗證失敗:', error);
        res.status(500).json({ error: '驗證服務異常' });
    }
}

module.exports = requireTotp;
