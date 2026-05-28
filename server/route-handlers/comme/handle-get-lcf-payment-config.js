const { getEcpayConfigByMerchantId } = require('../../store/ecpay-config');
const { getSafeApiErrorMessage } = require('../../lib/safe-error-message');

module.exports = async (req, res) => {
    try {
        const rawMerchantId = req.params.merchantId;
        if (!rawMerchantId || !rawMerchantId.trim()) {
            res.status(400).json({ error: '請提供 merchantId' });
            return;
        }

        const config = await getEcpayConfigByMerchantId(rawMerchantId.trim());
        if (!config) {
            res.status(404).json({ error: '找不到該商店設定' });
            return;
        }

        res.status(200).json({
            lcfEcpayEnabled: config.lcfEcpayEnabled !== false,
            lcfPayuniEnabled: config.lcfPayuniEnabled !== false,
            lcfOpayEnabled: config.lcfOpayEnabled !== false,
        });
    } catch (error) {
        console.error('[get-lcf-payment-config]', error);
        res.status(500).json({
            error: getSafeApiErrorMessage(error, '取得付款設定失敗'),
        });
    }
};
