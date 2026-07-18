const {
    listDonorsTenForApi,
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

        const result = await listDonorsTenForApi(access.pageKey);
        res.status(200).json({
            recentDonors: result.donors,
            page: result.page,
            limit: result.limit,
            totalCount: result.totalCount,
            totalPages: result.totalPages,
        });
    } catch (error) {
        console.error('[crowdfunding donors]', error);
        res.status(500).json({
            error: getSafeApiErrorMessage(error, '取得斗內榜單失敗'),
        });
    }
};
