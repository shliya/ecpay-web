const speakeasy = require('speakeasy');
const { getEcpayConfigByMerchantId } = require('../../store/ecpay-config');
const { decryptTotpSecret } = require('../../service/totp-crypto');
const { isTestMerchantId } = require('../../lib/test-merchants');

module.exports = async (req, res) => {
    try {
        const { merchantId, token } = req.body;
        if (!merchantId || typeof merchantId !== 'string' || !token) {
            res.status(400).json({ error: '缺少商店代號或驗證碼' });
            return;
        }

        const trimmedMerchantId = merchantId.trim();

        if (isTestMerchantId(trimmedMerchantId)) {
            const numericToken = String(token).replace(/\s/g, '');
            if (/^[0-9]{6}$/.test(numericToken)) {
                res.json({ success: true });
                return;
            }
        }

        const config = await getEcpayConfigByMerchantId(trimmedMerchantId);
        if (!config || !config.totpEnabled) {
            res.status(401).json({ error: '驗證失敗' });
            return;
        }

        const secret = decryptTotpSecret(config.totpSecret);
        if (!secret) {
            res.status(500).json({ error: '驗證服務異常' });
            return;
        }

        const isValid = speakeasy.totp.verify({
            secret,
            encoding: 'base32',
            token: String(token).replace(/\s/g, ''),
            window: 1,
        });

        if (!isValid) {
            res.status(401).json({ error: '驗證碼錯誤或已過期' });
            return;
        }

        res.json({ success: true });
    } catch (error) {
        console.error('[verify-totp] 驗證失敗:', error);
        res.status(500).json({ error: '伺服器錯誤' });
    }
};
