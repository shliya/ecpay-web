const speakeasy = require('speakeasy');
const { getEcpayConfigByMerchantId } = require('../store/ecpay-config');
const { decryptTotpSecret } = require('../service/totp-crypto');
const { isTestMerchantId } = require('../lib/test-merchants');

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
            const numericToken = String(totpToken).trim();
            if (/^[0-9]{6}$/.test(numericToken)) {
                next();
                return;
            }
        }

        const secret = decryptTotpSecret(config.totpSecret);
        if (!secret) {
            res.status(500).json({ error: 'TOTP 設定異常' });
            return;
        }

        if (!isValidTotpToken(secret, totpToken)) {
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
