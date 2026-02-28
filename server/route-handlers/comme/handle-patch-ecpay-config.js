const { updateEcpayConfig } = require('../../service/ecpay-config');
const { getEcpayConfigByMerchantId } = require('../../store/ecpay-config');

module.exports = async (req, res) => {
    try {
        const { merchantId } = req.params;
        const updates = req.body || {};

        if (!merchantId || !merchantId.trim()) {
            res.status(400).json({ error: '請提供 merchantId' });
            return;
        }

        const config = await getEcpayConfigByMerchantId(merchantId.trim());
        if (!config) {
            res.status(404).json({ error: '找不到該商店設定' });
            return;
        }

        const updated = await updateEcpayConfig(merchantId.trim(), updates);

        if (!updated) {
            res.status(500).json({ error: '更新失敗' });
            return;
        }

        res.status(200).json({
            merchantId: updated.merchantId,
            displayName: updated.displayName || null,
            hashKey: updated.hashKey || null,
            hashIV: updated.hashIV || null,
            payuniMerchantId: updated.payuniMerchantId || null,
            payuniHashKey: updated.payuniHashKey || null,
            payuniHashIV: updated.payuniHashIV || null,
            youtubeChannelHandle: updated.youtubeChannelHandle || null,
            youtubeChannelId: updated.youtubeChannelId || null,
            themeColors: updated.themeColors || null,
        });
    } catch (error) {
        console.error('[patch-ecpay-config]', error);
        if (error.message && error.message.includes('displayName')) {
            res.status(400).json({
                error: error.message,
            });
            return;
        }
        res.status(500).json({
            error: error.message || '更新設定失敗',
        });
    }
};
