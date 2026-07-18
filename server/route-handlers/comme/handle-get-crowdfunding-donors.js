const {
    listDonorsPagedForApi,
} = require('../../service/large-crowdfunding-donation');
const { getSafeApiErrorMessage } = require('../../lib/safe-error-message');
const DonationStore = require('../../store/large-crowdfunding-donation');
const {
    assertPublicDonorPageAccess,
} = require('../../lib/large-crowdfunding-public-access');

function parseQueryPage(raw) {
    const n = Number(raw);
    if (!Number.isFinite(n) || n < 1) {
        return 1;
    }
    return Math.floor(n);
}

function parseQueryLimit(raw) {
    if (raw == null || raw === '') {
        return DonationStore.DEFAULT_RECENT_LIMIT;
    }
    const n = Number(raw);
    if (!Number.isFinite(n) || n < 1) {
        return DonationStore.DEFAULT_RECENT_LIMIT;
    }
    return Math.min(Math.floor(n), DonationStore.MAX_PAGE_LIMIT);
}

module.exports = async (req, res) => {
    try {
        const access = await assertPublicDonorPageAccess(req.params.pageKey);
        if (!access.ok) {
            res.status(access.status).json({ error: access.error });
            return;
        }

        const page = parseQueryPage(req.query.page);
        const limit = parseQueryLimit(req.query.limit);

        const result = await listDonorsPagedForApi(access.pageKey, {
            page,
            limit,
        });
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
