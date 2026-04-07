const {
    getPayuniConfigByPayuniMerchantId,
    getPayuniMerchantIdByMerchantId,
} = require('../../service/ecpay-config');
const { createPayment } = require('../../lib/payment-providers/payuni');
const { getSafeApiErrorMessage } = require('../../lib/safe-error-message');
const {
    parseYoutubeDonationFromInput,
    encodeYoutubeVideoPayloadForPayment,
    computePlaySecondsFromAmount,
} = require('../../lib/youtube-donation');

module.exports = async (req, res) => {
    try {
        const { merchantId, amount, name, message, youtubeUrl } =
            req.body || {};

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
        if (amountNum > 100000) {
            res.status(400).json({ error: 'amount 不可超過 100000' });
            return;
        }

        let videoId = null;
        if (youtubeUrl != null && String(youtubeUrl).trim()) {
            const yt = parseYoutubeDonationFromInput(String(youtubeUrl));
            if (!yt.videoId) {
                res.status(400).json({
                    error: 'YouTube 網址或影片 ID 格式不正確',
                });
                return;
            }
            if (computePlaySecondsFromAmount(amountNum) <= 0) {
                res.status(400).json({
                    error: '影片斗內金額至少 30 元',
                });
                return;
            }
            videoId = encodeYoutubeVideoPayloadForPayment(
                yt.videoId,
                yt.startSec
            );
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

        if (videoId) {
            orderData.videoId = videoId;
        }

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
        res.status(500).json({
            error: getSafeApiErrorMessage(error, '建立斗內訂單失敗'),
        });
    }
};
