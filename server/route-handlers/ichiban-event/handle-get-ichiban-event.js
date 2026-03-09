const {
    getIchibanEventByIdAndMerchantId,
} = require('../../service/ichiban-event');
const { getEcpayConfigByMerchantId } = require('../../store/ecpay-config');
const { getSafeApiErrorMessage } = require('../../lib/safe-error-message');

module.exports = async (req, res) => {
    try {
        const { id, merchantId } = req.params;

        if (!merchantId) {
            return res.status(400).json({ error: 'merchantId is required' });
        }

        const event = await getIchibanEventByIdAndMerchantId(id, merchantId);

        if (!event) {
            return res.status(404).json({ error: '活動不存在' });
        }

        const config = await getEcpayConfigByMerchantId(merchantId);
        const availablePaymentMethods = {
            ecpay: !!config?.merchantId,
            payuni: !!config?.payuniMerchantId,
        };

        const plainEvent = event.get ? event.get({ plain: true }) : event;
        res.json({
            ...plainEvent,
            availablePaymentMethods,
        });
    } catch (error) {
        console.error('取得一番賞活動時發生錯誤:', error);
        res.status(500).json({ error: getSafeApiErrorMessage(error) });
    }
};
