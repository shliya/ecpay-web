const {
    listSpecialDonorsForApi,
} = require('../../service/large-crowdfunding-donation');
const { getSafeApiErrorMessage } = require('../../lib/safe-error-message');
const {
    assertPublicDonorPageAccess,
} = require('../../lib/large-crowdfunding-public-access');

module.exports = async (req, res) => {
    try {
        const access = await assertPublicDonorPageAccess(req.params.pageKey);
        if (!access.ok) {
            res.status(access.status).json({ error: access.error });
            return;
        }

        const result = await listSpecialDonorsForApi(access.pageKey);
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
