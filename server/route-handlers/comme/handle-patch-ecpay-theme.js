const { updateEcpayTheme } = require('../../service/ecpay-config');
const { getEcpayConfigByMerchantId } = require('../../store/ecpay-config');
const { getSafeApiErrorMessage } = require('../../lib/safe-error-message');
const { ECPAY_CONFIG_DUPLICATE_CODE } = require('../../lib/error/code');

function sanitizeUpdates(rawUpdates) {
    const updates =
        rawUpdates && typeof rawUpdates === 'object' ? rawUpdates : {};
    return updates;
}

module.exports = async (req, res) => {
    try {
        const rawMerchantId = req.params.merchantId;
        if (!rawMerchantId || !rawMerchantId.trim()) {
            res.status(400).json({ error: '請提供 merchantId' });
            return;
        }

        const merchantId = rawMerchantId.trim();
        const updates = sanitizeUpdates(req.body || {});

        const config = await getEcpayConfigByMerchantId(merchantId);
        if (!config) {
            res.status(404).json({ error: '找不到該商店設定' });
            return;
        }

        const updated = await updateEcpayTheme(merchantId, updates.themeColors);

        if (!updated) {
            res.status(500).json({ error: '更新失敗' });
            return;
        }

        const body = {
            merchantId: updated.merchantId,
            themeColors: updated.themeColors || null,
        };

        res.status(200).json(body);
    } catch (error) {
        console.error('[patch-ecpay-config]', error);
        if (
            error &&
            error.message &&
            error.message === ECPAY_CONFIG_DUPLICATE_CODE.message
        ) {
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
