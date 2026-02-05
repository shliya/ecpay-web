const { getEcpayConfigByMerchantId } = require('../../store/ecpay-config');
const { createDonation } = require('../../service/donation');
const { parseDonationCallback } = require('../../lib/payment-providers/ecpay');

module.exports = async (req, res) => {
    try {
        const { merchantId } = req.params;
        const config = await getEcpayConfigByMerchantId(merchantId);

        if (!config) {
            throw new Error(`無法讀取商店 ${merchantId} 的設定`);
        }

        const row = parseDonationCallback(req.body, {
            hashKey: config.hashKey,
            hashIV: config.hashIV,
        });

        if (row) {
            await createDonation(row);
        }

        res.send('1|OK');
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: error.message });
    }
};
