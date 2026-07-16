const { getEcpayConfigByMerchantId } = require('../../store/ecpay-config');
const { createDonation } = require('../../service/donation');
const { parseDonationCallback } = require('../../lib/payment-providers/ecpay');
const { getSafeApiErrorMessage } = require('../../lib/safe-error-message');

module.exports = async (req, res) => {
    try {
        const { merchantId } = req.params;
        const urlMerchantId = String(merchantId || '').trim();
        const config = await getEcpayConfigByMerchantId(urlMerchantId);

        if (!config) {
            throw new Error(`無法讀取商店 ${urlMerchantId} 的設定`);
        }

        const row = parseDonationCallback(req.body, {
            hashKey: config.hashKey,
            hashIV: config.hashIV,
        });

        if (row) {
            const payloadMerchantId = String(row.merchantId || '').trim();
            // 密文 MerchantID 必須與 URL／解密所用商店一致，避免自註冊 key 偽造寫入他店
            if (
                !payloadMerchantId ||
                payloadMerchantId !== urlMerchantId
            ) {
                console.warn(
                    '[ecpay-notify] MerchantID 與 URL 不符，拒絕入帳',
                    { urlMerchantId, payloadMerchantId }
                );
                res.status(400).send('0|ERROR');
                return;
            }
            row.merchantId = urlMerchantId;
            await createDonation(row);
        }

        res.send('1|OK');
    } catch (error) {
        console.error(error);
        res.status(500).json({
            error: getSafeApiErrorMessage(error),
        });
    }
};
