const { updateEcpayConfig } = require('../../service/ecpay-config');
const { getEcpayConfigByMerchantId } = require('../../store/ecpay-config');
const { getSafeApiErrorMessage } = require('../../lib/safe-error-message');

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

        const hasSensitiveEcpay =
            updates.hasOwnProperty('hashKey') ||
            updates.hasOwnProperty('hashIV');
        const hasSensitivePayuni =
            updates.hasOwnProperty('payuniHashKey') ||
            updates.hasOwnProperty('payuniHashIV');

        const body = {
            merchantId: updated.merchantId,
            displayName: updated.displayName || null,
            payuniMerchantId: updated.payuniMerchantId || null,
            youtubeChannelHandle: updated.youtubeChannelHandle || null,
            youtubeChannelId: updated.youtubeChannelId || null,
            themeColors: updated.themeColors || null,
        };
        if (hasSensitiveEcpay) {
            body.hashKey = updated.hashKey || null;
            body.hashIV = updated.hashIV || null;
        }
        if (hasSensitivePayuni) {
            body.payuniHashKey = updated.payuniHashKey || null;
            body.payuniHashIV = updated.payuniHashIV || null;
        }

        res.status(200).json(body);
    } catch (error) {
        console.error('[patch-ecpay-config]', error);
        if (error.message && error.message.includes('displayName')) {
            res.status(400).json({
                error: error.message,
            });
            return;
        }
        res.status(500).json({
            error: getSafeApiErrorMessage(error, '更新設定失敗'),
        });
    }
};
