const speakeasy = require('speakeasy');
const { getEcpayConfigByMerchantId } = require('../../store/ecpay-config');
const { updateEcpayConfig } = require('../../store/ecpay-config');
const { encryptTotpSecret } = require('../../service/totp-crypto');
const {
    verifyMerchantKeyOwnership,
} = require('../../lib/merchant-ownership');

module.exports = async (req, res) => {
    try {
        const { merchantId, hashKey, payuniHashKey } = req.body;
        if (!merchantId || typeof merchantId !== 'string') {
            res.status(400).json({ error: '缺少 merchantId' });
            return;
        }

        if (
            !(String(hashKey || '').trim() || String(payuniHashKey || '').trim())
        ) {
            res.status(400).json({
                error: '請提供 Hash Key（綠界 hashKey 或 PayUni payuniHashKey）以驗證商店所有權',
            });
            return;
        }

        const config = await getEcpayConfigByMerchantId(merchantId.trim());
        if (!config) {
            res.status(404).json({ error: '商店不存在' });
            return;
        }

        if (config.totpEnabled) {
            res.status(400).json({ error: '已綁定 TOTP，無需重複設定' });
            return;
        }

        if (
            !verifyMerchantKeyOwnership(config, { hashKey, payuniHashKey })
        ) {
            res.status(403).json({ error: '金流金鑰驗證失敗，無法綁定 TOTP' });
            return;
        }

        const secret = speakeasy.generateSecret({
            name: `ecpay-web (${config.displayName || merchantId})`,
            length: 20,
        });

        const encryptedSecret = encryptTotpSecret(secret.base32);
        await updateEcpayConfig(merchantId.trim(), {
            totpSecret: encryptedSecret,
            totpEnabled: false,
        });

        res.json({
            otpauthUrl: secret.otpauth_url,
            secret: secret.base32,
        });
    } catch (error) {
        console.error('TOTP 設定失敗:', error);
        res.status(500).json({ error: '伺服器錯誤' });
    }
};
