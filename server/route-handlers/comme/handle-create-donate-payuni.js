const {
    getPayuniConfigByPayuniMerchantId,
    getPayuniMerchantIdByMerchantId,
} = require('../../service/ecpay-config'); // 確認一下這裡檔名是不是 ecpay-config
const { createPayment } = require('../../lib/payment-providers/payuni');

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
        const ecpayConfig = await getPayuniMerchantIdByMerchantId(
            merchantId.trim()
        );
        if (!ecpayConfig) {
            res.status(404).json({ error: '找不到該商店設定' });
            return;
        }

        const config = await getPayuniConfigByPayuniMerchantId(
            ecpayConfig.payuniMerchantId,
            {
                properties: [
                    'payuniMerchantId',
                    'payuniHashKey',
                    'payuniHashIV',
                ],
            }
        );
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

        const result = await createPayment(config.payuniMerchantId, orderData, {
            hashKey: config.payuniHashKey,
            hashIV: config.payuniHashIV,
        });
        console.log('[Payuni CreateOrder]: ', result.merchantTradeNo);

        res.status(200).json({
            paymentUrl: result.paymentUrl,
            params: result.params,
        });
    } catch (error) {
        console.error('[donate/payuni]', error);
        res.status(500).json({ error: error.message || '建立斗內訂單失敗' });
    }
};
