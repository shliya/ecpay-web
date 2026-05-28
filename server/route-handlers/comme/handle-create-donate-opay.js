const { getEcpayConfigByMerchantId } = require('../../store/ecpay-config');
const { setPaymentOrder } = require('../../store/payment-order');
const { createPayment } = require('../../lib/payment-providers/opay');
const {
    resolveDonateContext,
} = require('../../service/large-crowdfunding-page');
const { getSafeApiErrorMessage } = require('../../lib/safe-error-message');
const {
    parseYoutubeDonationFromInput,
    encodeYoutubeVideoPayloadForPayment,
    computePlaySecondsFromAmount,
    getYoutubePricePerSecFromConfig,
    getYoutubeMaxPlaySecFromConfig,
} = require('../../lib/youtube-donation');

module.exports = async (req, res) => {
    try {
        const {
            merchantId,
            amount,
            name,
            message,
            youtubeUrl,
            largeCrowdfundingPageId,
        } = req.body || {};

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

        const config = await getEcpayConfigByMerchantId(merchantId.trim());
        if (!config) {
            res.status(404).json({ error: '找不到該商店設定' });
            return;
        }

        let lcfContext = null;
        try {
            lcfContext = await resolveDonateContext(
                merchantId.trim(),
                largeCrowdfundingPageId
            );
        } catch (lcfErr) {
            res.status(lcfErr.statusCode || 400).json({
                error: lcfErr.message || '大型募資狀態不允許斗內',
            });
            return;
        }
        if (
            largeCrowdfundingPageId != null &&
            largeCrowdfundingPageId !== '' &&
            !lcfContext
        ) {
            res.status(400).json({ error: 'largeCrowdfundingPageId 無效' });
            return;
        }
        if (config.opayEnabled === false) {
            res.status(403).json({ error: '此付款已關閉' });
            return;
        }
        if (
            !config.opayMerchantId ||
            !String(config.opayMerchantId).trim() ||
            !config.opayHashKey ||
            !config.opayHashIV
        ) {
            res.status(404).json({ error: '找不到該商店設定' });
            return;
        }

        const hasYoutubeUrl =
            youtubeUrl != null && String(youtubeUrl).trim();
        if (hasYoutubeUrl && config.youtubeDonationEnabled !== true) {
            res.status(403).json({ error: '影音斗內已關閉' });
            return;
        }

        const pricePerSec = getYoutubePricePerSecFromConfig(config);
        const maxPlaySec = getYoutubeMaxPlaySecFromConfig(config);

        let videoId = null;
        if (youtubeUrl != null && String(youtubeUrl).trim()) {
            const yt = parseYoutubeDonationFromInput(String(youtubeUrl));
            if (!yt.videoId) {
                res.status(400).json({
                    error: 'YouTube 網址或影片 ID 格式不正確',
                });
                return;
            }
            if (
                computePlaySecondsFromAmount(
                    amountNum,
                    pricePerSec,
                    maxPlaySec
                ) <= 0
            ) {
                res.status(400).json({
                    error: `影片斗內金額須至少 ${pricePerSec} 元（每秒 ${pricePerSec} 元）`,
                });
                return;
            }
            videoId = encodeYoutubeVideoPayloadForPayment(
                yt.videoId,
                yt.startSec
            );
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

        const result = await createPayment(
            String(config.opayMerchantId).trim(),
            orderData,
            {
                hashKey: config.opayHashKey,
                hashIV: config.opayHashIV,
            }
        );

        const orderMeta = {
            kind: 'opay-donation',
            fullMessage: orderData.message || '',
            fullName: orderData.name || '',
        };
        if (lcfContext) {
            orderMeta.largeCrowdfundingPageId = lcfContext.pageId;
            orderMeta.ecpayConfigId = lcfContext.ecpayConfigId;
        }
        if (videoId) {
            orderMeta.youtubeVideoPayload = videoId;
        }
        await setPaymentOrder(result.merchantTradeNo, orderMeta);
        console.log('[OPay ReturnUrl]', result.params.ReturnURL);

        res.status(200).json({
            paymentUrl: result.paymentUrl,
            params: result.params,
        });
    } catch (error) {
        console.error('[donate/opay]', error);
        res.status(500).json({
            error: getSafeApiErrorMessage(error, '建立斗內訂單失敗'),
        });
    }
};
