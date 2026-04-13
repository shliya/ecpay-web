const { updateEcpayConfig } = require('../../service/ecpay-config');
const { getEcpayConfigByMerchantId } = require('../../store/ecpay-config');
const { getSafeApiErrorMessage } = require('../../lib/safe-error-message');
const { ECPAY_CONFIG_DUPLICATE_CODE } = require('../../lib/error/code');

function normalizeBlockedKeywords(value) {
    if (!Array.isArray(value)) {
        return [];
    }

    return value
        .filter(keyword => typeof keyword === 'string')
        .map(keyword => keyword.trim())
        .filter(keyword => keyword && keyword.length <= 50)
        .map(keyword => keyword.replace(/[<>"'`]/g, ''));
}

const ECPAY_HASH_KEYS = ['hashKey', 'hashIV'];

function sanitizeUpdates(rawUpdates) {
    const updates =
        rawUpdates && typeof rawUpdates === 'object' ? rawUpdates : {};
    const result = { ...updates };

    if (Object.hasOwn(updates, 'blockedKeywords')) {
        result.blockedKeywords = normalizeBlockedKeywords(
            updates.blockedKeywords
        );
    }

    for (const key of ECPAY_HASH_KEYS) {
        if (Object.hasOwn(result, key) && !result[key]) {
            delete result[key];
        }
    }

    return result;
}

module.exports = async (req, res) => {
    try {
        const rawMerchantId = req.params.merchantId;
        if (!rawMerchantId || !rawMerchantId.trim()) {
            res.status(400).json({ error: '請提供 merchantId' });
            return;
        }

        const merchantId = rawMerchantId.trim();
        const updates = sanitizeUpdates(req.body || {});

        const config = await getEcpayConfigByMerchantId(merchantId);
        if (!config) {
            res.status(404).json({ error: '找不到該商店設定' });
            return;
        }

        const updated = await updateEcpayConfig(merchantId, updates);

        if (!updated) {
            res.status(500).json({ error: '更新失敗' });
            return;
        }

        const hasSensitiveEcpay =
            updates.hasOwnProperty('hashKey') ||
            updates.hasOwnProperty('hashIV');
        const hasSensitivePayuni =
            updates.hasOwnProperty('payuniHashKey') ||
            updates.hasOwnProperty('payuniHashIV');

        const blockedKeywords = normalizeBlockedKeywords(
            updated.blockedKeywords
        );

        const body = {
            merchantId: updated.merchantId,
            displayName: updated.displayName || null,
            payuniMerchantId: updated.payuniMerchantId || null,
            youtubeChannelHandle: updated.youtubeChannelHandle || null,
            youtubeChannelId: updated.youtubeChannelId || null,
            themeColors: updated.themeColors || null,
            blockedKeywords,
            ecpayEnabled: updated.ecpayEnabled !== false,
            payuniEnabled: updated.payuniEnabled !== false,
            hasSensitiveEcpayUpdate: hasSensitiveEcpay,
            hasSensitivePayuniUpdate: hasSensitivePayuni,
        };

        res.status(200).json(body);
    } catch (error) {
        console.error('[patch-ecpay-config]', error);
        if (
            error &&
            error.message &&
            error.message === ECPAY_CONFIG_DUPLICATE_CODE.message
        ) {
            res.status(400).json({
                error: error.message,
            });
            return;
        }
        res.status(500).json({
            error: getSafeApiErrorMessage(error, '更新設定失敗'),
        });
    }
};
