const { updateEcpayConfig } = require('../../service/ecpay-config');
const { getEcpayConfigByMerchantId } = require('../../store/ecpay-config');
const { getSafeApiErrorMessage } = require('../../lib/safe-error-message');

module.exports = async (req, res) => {
    try {
        const rawMerchantId = req.params.merchantId;
        if (!rawMerchantId || !rawMerchantId.trim()) {
            res.status(400).json({ error: '請提供 merchantId' });
            return;
        }

        const merchantId = rawMerchantId.trim();
        const config = await getEcpayConfigByMerchantId(merchantId);
        if (!config) {
            res.status(404).json({ error: '找不到該商店設定' });
            return;
        }

        const body = req.body && typeof req.body === 'object' ? req.body : {};
        const updates = {};
        if (Object.hasOwn(body, 'lcfEcpayEnabled')) {
            updates.lcfEcpayEnabled = body.lcfEcpayEnabled === true;
        }
        if (Object.hasOwn(body, 'lcfPayuniEnabled')) {
            updates.lcfPayuniEnabled = body.lcfPayuniEnabled === true;
        }
        if (Object.hasOwn(body, 'lcfOpayEnabled')) {
            updates.lcfOpayEnabled = body.lcfOpayEnabled === true;
        }

        if (!Object.keys(updates).length) {
            res.status(400).json({ error: '請提供至少一項付款開關' });
            return;
        }

        const updated = await updateEcpayConfig(merchantId, updates);
        if (!updated) {
            res.status(500).json({ error: '更新失敗' });
            return;
        }

        res.status(200).json({
            lcfEcpayEnabled: updated.lcfEcpayEnabled !== false,
            lcfPayuniEnabled: updated.lcfPayuniEnabled !== false,
            lcfOpayEnabled: updated.lcfOpayEnabled !== false,
        });
    } catch (error) {
        console.error('[patch-lcf-payment-config]', error);
        res.status(500).json({
            error: getSafeApiErrorMessage(error, '更新付款設定失敗'),
        });
    }
};
