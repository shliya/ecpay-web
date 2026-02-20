const { getEcpayConfigByMerchantId } = require('../../store/ecpay-config');
const { createPayment } = require('../../lib/payment-providers/ecpay');

module.exports = async (req, res) => {
    try {
        const { merchantId, amount, name, message } = req.body || {};

        if (
            !merchantId ||
            typeof merchantId !== 'string' ||
            !merchantId.trim()
        ) {
            res.status(400).json({ error: 'merchantId 為必填' });
            return;
        }

        const amountNum = Number(amount);
        if (!Number.isInteger(amountNum) || amountNum <= 0) {
            res.status(400).json({ error: 'amount 須為正整數' });
            return;
        }

        const config = await getEcpayConfigByMerchantId(merchantId.trim());
        if (!config) {
            res.status(404).json({ error: '找不到該商店設定' });
            return;
        }

        const orderData = {
            amount: amountNum,
            description:
                message && String(message).trim()
                    ? String(message).trim()
                    : '觀眾贊助',
            itemName:
                name && String(name).trim()
                    ? `贊助 - ${String(name).trim()}`
                    : '贊助',
            name: name != null ? String(name).trim() : '',
            message: message != null ? String(message).trim() : '',
        };

        const result = await createPayment(merchantId.trim(), orderData);
        console.log('[ReturnUrl]: ', result.params.ReturnURL);

        res.status(200).json({
            paymentUrl: result.paymentUrl,
            params: result.params,
        });
    } catch (error) {
        console.error('[donate/ecpay]', error);
        res.status(500).json({ error: error.message || '建立斗內訂單失敗' });
    }
};
