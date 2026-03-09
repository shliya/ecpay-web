const speakeasy = require('speakeasy');
const { getEcpayConfigByMerchantId } = require('../../store/ecpay-config');
const { updateEcpayConfig } = require('../../store/ecpay-config');
const { encryptTotpSecret } = require('../../service/totp-crypto');

module.exports = async (req, res) => {
    try {
        const { merchantId } = req.body;
        if (!merchantId || typeof merchantId !== 'string') {
            res.status(400).json({ error: '缺少 merchantId' });
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
