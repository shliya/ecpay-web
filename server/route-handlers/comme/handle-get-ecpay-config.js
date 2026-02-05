const { getEcpayConfigByMerchantId } = require('../../store/ecpay-config');

module.exports = async (req, res) => {
    try {
        const { merchantId } = req.params;
        if (!merchantId || !merchantId.trim()) {
            res.status(400).json({ error: '請提供 merchantId' });
            return;
        }

        const config = await getEcpayConfigByMerchantId(merchantId.trim());
        if (!config) {
            res.status(404).json({ error: '找不到該商店設定' });
            return;
        }

        res.status(200).json({
            merchantId: config.merchantId,
            displayName: config.displayName || null,
            hashKey: config.hashKey || null,
            hashIV: config.hashIV || null,
            youtubeChannelHandle: config.youtubeChannelHandle || null,
            youtubeChannelId: config.youtubeChannelId || null,
            themeColors: config.themeColors || null,
        });
    } catch (error) {
        console.error('[get-ecpay-config]', error);
        res.status(500).json({ error: error.message || '取得設定失敗' });
    }
};
