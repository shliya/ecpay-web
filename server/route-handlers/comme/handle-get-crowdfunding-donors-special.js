const {
    listSpecialDonorsForApi,
} = require('../../service/large-crowdfunding-donation');
const { normalizePageKey } = require('../../lib/large-crowdfunding');
const { getSafeApiErrorMessage } = require('../../lib/safe-error-message');

module.exports = async (req, res) => {
    try {
        const { pageKey } = req.params;
        const key = normalizePageKey(pageKey);
        if (!key) {
            res.status(400).json({ error: 'pageKey 無效' });
            return;
        }

        const result = await listSpecialDonorsForApi(key);
        res.status(200).json({
            recentDonors: result.donors,
        });
    } catch (error) {
        console.error('[crowdfunding donors special]', error);
        res.status(500).json({
            error: getSafeApiErrorMessage(error, '取得特殊主題榜單失敗'),
        });
    }
};
