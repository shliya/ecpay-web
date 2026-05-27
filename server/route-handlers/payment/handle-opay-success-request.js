const {
    parseUrlDonationCallback,
    verifyOpayReturnCheckMac,
} = require('../../lib/payment-providers/opay');
const {
    getPaymentOrder,
    deletePaymentOrder,
} = require('../../store/payment-order');
const { getEcpayConfigByMerchantId } = require('../../store/ecpay-config');
const {
    completeDonationFromPayment,
} = require('../../service/large-crowdfunding-donation');
const {
    buildVideoTaskFromVideoIdAndCost,
    getYoutubePricePerSecFromConfig,
    getYoutubeMaxPlaySecFromConfig,
} = require('../../lib/youtube-donation');

/** donations / LCF 多以綠界 merchantId 識別賣家；回調 body 為 OPay 商店代號 */
function merchantIdFallbackForGreenWorldRow(opayMerchantIdFromBody, cfg) {
    const opayConfigured =
        cfg.opayMerchantId != null
            ? String(cfg.opayMerchantId).trim()
            : '';
    const opayBody = String(opayMerchantIdFromBody || '').trim();
    const green = cfg.merchantId ? String(cfg.merchantId).trim() : '';
    if (green && opayConfigured && opayConfigured === opayBody) {
        return green;
    }
    return opayBody;
}

module.exports = async (req, res) => {
    try {
        if (process.env.NODE_ENV !== 'production') {
            console.log('[opay-success] 收到回調', {
                hasBody: !!req.body,
                keys: req.body ? Object.keys(req.body) : [],
            });
        }

        const { MerchantTradeNo, MerchantID } = req.body || {};
        const merchantKey = MerchantID || (req.body && req.body.MerchantID);

        const config = merchantKey
            ? await getEcpayConfigByMerchantId(String(merchantKey).trim())
            : null;

        if (!config || !config.opayHashKey || !config.opayHashIV) {
            res.status(400).send('0|ERROR');
            return;
        }

        const opayMacConfig = {
            hashKey: config.opayHashKey,
            hashIV: config.opayHashIV,
            youtubeDonationAmount: config.youtubeDonationAmount,
            youtubeDonationMaxPlaySec: config.youtubeDonationMaxPlaySec,
        };

        if (!verifyOpayReturnCheckMac(req.body, opayMacConfig)) {
            res.status(400).send('0|ERROR');
            return;
        }

        const pendingDonation = MerchantTradeNo
            ? await getPaymentOrder(MerchantTradeNo)
            : null;
        const isOpayDonate =
            pendingDonation && pendingDonation.kind === 'opay-donation';

        const row = parseUrlDonationCallback(req.body, opayMacConfig);

        if (row) {
            if (isOpayDonate) {
                if (pendingDonation.fullMessage) {
                    row.message = pendingDonation.fullMessage;
                }
                if (pendingDonation.fullName) {
                    row.name = pendingDonation.fullName;
                }
            }
            if (!row.merTradeNo && MerchantTradeNo) {
                row.merTradeNo = MerchantTradeNo;
            }
            row.merchantId = merchantIdFallbackForGreenWorldRow(
                row.merchantId,
                config
            );
            if (
                isOpayDonate &&
                pendingDonation.youtubeVideoPayload != null &&
                String(pendingDonation.youtubeVideoPayload).trim()
            ) {
                const ytPayload =
                    String(pendingDonation.youtubeVideoPayload).trim();
                const videoTask = buildVideoTaskFromVideoIdAndCost(
                    ytPayload,
                    row.cost,
                    null,
                    {
                        pricePerSec:
                            getYoutubePricePerSecFromConfig(config),
                        maxPlaySec:
                            getYoutubeMaxPlaySecFromConfig(config),
                    }
                );
                if (videoTask) {
                    row.videoTask = videoTask;
                }
            }
            try {
                await completeDonationFromPayment(
                    row,
                    isOpayDonate ? pendingDonation : null
                );
            } catch (donationErr) {
                console.error(
                    '[opay-success] 斗內入帳失敗（仍回 1|OK）:',
                    donationErr
                );
            }
            if (isOpayDonate && MerchantTradeNo) {
                await deletePaymentOrder(MerchantTradeNo);
            }
        }

        res.status(200).send('1|OK');
    } catch (error) {
        console.error('歐付寶付款回調錯誤:', error);
        res.status(500).send('0|ERROR');
    }
};
