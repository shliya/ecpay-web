const {
    parseUrlDonationCallback,
    verifyOpayReturnCheckMac,
} = require('../../lib/payment-providers/opay');
const { getEcpayConfigByMerchantId } = require('../../store/ecpay-config');
const { processDonationFromPaymentCallback } = require('../../service/donation-payment-callback');
const {
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

        const row = parseUrlDonationCallback(req.body, opayMacConfig);

        if (row) {
            if (!row.merTradeNo && MerchantTradeNo) {
                row.merTradeNo = MerchantTradeNo;
            }
            row.merchantId = merchantIdFallbackForGreenWorldRow(
                row.merchantId,
                config
            );
            try {
                await processDonationFromPaymentCallback({
                    merchantTradeNo: MerchantTradeNo,
                    row,
                    logPrefix: 'opay-success',
                    youtubeConfig: {
                        pricePerSec: getYoutubePricePerSecFromConfig(config),
                        maxPlaySec: getYoutubeMaxPlaySecFromConfig(config),
                    },
                });
            } catch (donationErr) {
                console.error(
                    '[opay-success] 斗內入帳失敗（仍回 1|OK）:',
                    donationErr
                );
            }
        }

        res.status(200).send('1|OK');
    } catch (error) {
        console.error('歐付寶付款回調錯誤:', error);
        res.status(500).send('0|ERROR');
    }
};
