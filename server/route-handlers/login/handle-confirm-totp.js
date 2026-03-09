const speakeasy = require('speakeasy');
const { getEcpayConfigByMerchantId } = require('../../store/ecpay-config');
const { updateEcpayConfig } = require('../../store/ecpay-config');
const { decryptTotpSecret } = require('../../service/totp-crypto');

module.exports = async (req, res) => {
    try {
        const { merchantId, token } = req.body;
        if (!merchantId || typeof merchantId !== 'string' || !token) {
            res.status(400).json({ error: '缺少 merchantId 或驗證碼' });
            return;
        }

        const config = await getEcpayConfigByMerchantId(merchantId.trim());
        if (!config) {
            res.status(404).json({ error: '商店不存在' });
            return;
        }

        if (config.totpEnabled) {
            res.status(400).json({ error: '已綁定 TOTP' });
            return;
        }

        const secret = decryptTotpSecret(config.totpSecret);
        if (!secret) {
            res.status(400).json({ error: '請先取得 QR Code 再驗證' });
            return;
        }

        const isValid = speakeasy.totp.verify({
            secret,
            encoding: 'base32',
            token: String(token).replace(/\s/g, ''),
            window: 1,
        });

        if (!isValid) {
            res.status(400).json({ error: '驗證碼錯誤' });
            return;
        }

        await updateEcpayConfig(merchantId.trim(), { totpEnabled: true });

        res.json({ success: true });
    } catch (error) {
        console.error('TOTP 確認失敗:', error);
        res.status(500).json({ error: '伺服器錯誤' });
    }
};
