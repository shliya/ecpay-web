const {
    listDonorsPagedForApi,
} = require('../../service/large-crowdfunding-donation');
const { normalizePageKey } = require('../../lib/large-crowdfunding');
const { getSafeApiErrorMessage } = require('../../lib/safe-error-message');
const DonationStore = require('../../store/large-crowdfunding-donation');

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
        const { pageKey } = req.params;
        const key = normalizePageKey(pageKey);
        if (!key) {
            res.status(400).json({ error: 'pageKey 無效' });
            return;
        }

        const page = parseQueryPage(req.query.page);
        const limit = parseQueryLimit(req.query.limit);

        const result = await listDonorsPagedForApi(key, { page, limit });
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
