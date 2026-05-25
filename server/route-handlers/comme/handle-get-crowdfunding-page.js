const {
    getPageByMerchantIdAndPageKey,
} = require('../../service/large-crowdfunding-page');
const { normalizePageKey } = require('../../lib/large-crowdfunding');
const { getSafeApiErrorMessage } = require('../../lib/safe-error-message');
const {
    rejectIfLargeCrowdfundingDisabled,
} = require('../../lib/large-crowdfunding-feature');

module.exports = async (req, res) => {
    try {
        const { merchantId, pageKey } = req.params;
        const key = normalizePageKey(pageKey);
        if (!merchantId?.trim() || !key) {
            res.status(400).json({ error: 'merchantId 或 pageKey 無效' });
            return;
        }
        const mid = merchantId.trim();
        if (!(await rejectIfLargeCrowdfundingDisabled(res, mid))) {
            return;
        }

        const page = await getPageByMerchantIdAndPageKey(mid, key);
        if (!page) {
            res.status(404).json({ error: '找不到大型募資設定' });
            return;
        }

        res.status(200).json(page);
    } catch (error) {
        console.error('[crowdfunding GET]', error);
        res.status(500).json({
            error: getSafeApiErrorMessage(error, '取得大型募資設定失敗'),
        });
    }
};
