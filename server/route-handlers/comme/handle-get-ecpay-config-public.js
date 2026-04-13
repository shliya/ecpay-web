const { getEcpayConfigByMerchantId } = require('../../store/ecpay-config');
const { getSafeApiErrorMessage } = require('../../lib/safe-error-message');
const {
    DEFAULT_YOUTUBE_PRICE_PER_SEC,
    YOUTUBE_DONATION_MAX_PLAY_SEC,
    normalizeYoutubePricePerSec,
} = require('../../lib/youtube-donation');

function toPublicConfig(config) {
    const amount = config.youtubeDonationAmount;
    const youtubeDonationAmount =
        amount != null
            ? normalizeYoutubePricePerSec(amount)
            : DEFAULT_YOUTUBE_PRICE_PER_SEC;
    return {
        merchantId: config.merchantId,
        displayName: config.displayName || null,
        youtubeChannelHandle: config.youtubeChannelHandle || null,
        youtubeChannelId: config.youtubeChannelId || null,
        themeColors: config.themeColors || null,
        youtubeDonationAmount,
        youtubeDonationMaxPlaySec: YOUTUBE_DONATION_MAX_PLAY_SEC,
    };
}

module.exports = async (req, res) => {
    try {
        const { merchantId } = req.params;
        if (!merchantId || !merchantId.trim()) {
            res.status(400).json({ error: '請提供 merchantId' });
            return;
        }

        const config = await getEcpayConfigByMerchantId(merchantId.trim());
        if (!config) {
            res.status(404).json({ error: '找不到該商店設定' });
            return;
        }

        res.status(200).json(toPublicConfig(config));
    } catch (error) {
        console.error('[get-ecpay-config-public]', error);
        res.status(500).json({
            error: getSafeApiErrorMessage(error, '取得設定失敗'),
        });
    }
};
