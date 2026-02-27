const {
    getPayuniConfigByPayuniMerchantId,
} = require('../../service/ecpay-config');
const { parseDonationCallback } = require('../../lib/payment-providers/payuni');
const { createDonation } = require('../../service/donation');

module.exports = async (req, res) => {
    try {
        const { merchantId } = req.params;

        const config = await getPayuniConfigByPayuniMerchantId(merchantId, {
            properties: [
                'id',
                'payuniMerchantId',
                'payuniHashKey',
                'payuniHashIV',
            ],
        });

        if (!config) {
            throw new Error(`無法讀取商店 ${merchantId} 的設定`);
        }

        const row = parseDonationCallback(req.body, req.query, {
            hashKey: config.payuniHashKey,
            hashIV: config.payuniHashIV,
            ecpayConfigId: config.id,
        });

        if (row) {
            await createDonation(row);
        }

        res.status(200).send('OK');
    } catch (error) {
        console.error('PAYUNi Webhook Error:', error);
        res.status(400).send('Error');
    }
};
