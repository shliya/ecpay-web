const {
    listRecentDonorsForApi,
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

        const donors = await listRecentDonorsForApi(key);
        res.status(200).json({ recentDonors: donors });
    } catch (error) {
        console.error('[crowdfunding donors]', error);
        res.status(500).json({
            error: getSafeApiErrorMessage(error, '取得斗內榜單失敗'),
        });
    }
};
