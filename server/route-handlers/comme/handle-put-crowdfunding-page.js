const { upsertPage } = require('../../service/large-crowdfunding-page');
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

        const page = await upsertPage(mid, key, req.body || {});
        res.status(200).json({ ok: true, page });
    } catch (error) {
        console.error('[crowdfunding PUT]', error);
        res.status(500).json({
            error: getSafeApiErrorMessage(error, '儲存大型募資設定失敗'),
        });
    }
};
