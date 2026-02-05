const {
    updateThemeColors,
    getEcpayConfigByMerchantId,
} = require('../../store/ecpay-config');

module.exports = async (req, res) => {
    try {
        const { merchantId } = req.params;
        const { themeColors } = req.body || {};

        if (!merchantId || !merchantId.trim()) {
            res.status(400).json({ error: '請提供 merchantId' });
            return;
        }

        const config = await getEcpayConfigByMerchantId(merchantId.trim());
        if (!config) {
            res.status(404).json({ error: '找不到該商店設定' });
            return;
        }

        const safe =
            themeColors != null && typeof themeColors === 'object'
                ? themeColors
                : null;
        await updateThemeColors(merchantId.trim(), safe);

        res.status(200).json({
            merchantId: merchantId.trim(),
            themeColors: safe,
        });
    } catch (error) {
        console.error('[patch-ecpay-theme]', error);
        res.status(500).json({ error: error.message || '更新主題失敗' });
    }
};
