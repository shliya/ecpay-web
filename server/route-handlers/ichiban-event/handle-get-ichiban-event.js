const {
    getIchibanEventByIdAndMerchantId,
} = require('../../service/ichiban-event');
const { getEcpayConfigByMerchantId } = require('../../store/ecpay-config');

module.exports = async (req, res) => {
    try {
        const { id, merchantId } = req.params;

        if (!merchantId) {
            return res.status(400).json({ error: 'merchantId is required' });
        }

        try {
            const event = await getIchibanEventByIdAndMerchantId(
                id,
                merchantId
            );

            if (!event) {
                return res.status(404).json({ error: 'Event not found' });
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
            if (error.code === 'ENOENT') {
                res.status(404).json({ error: 'Event not found' });
            } else {
                throw error;
            }
        }
    } catch (error) {
        console.error('檢查商店時發生錯誤:', error);
        res.status(500).json({ error: error.message });
    }
};
