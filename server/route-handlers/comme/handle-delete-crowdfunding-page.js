const { deletePage } = require('../../service/large-crowdfunding-page');
const { normalizePageKey } = require('../../lib/large-crowdfunding');
const { getSafeApiErrorMessage } = require('../../lib/safe-error-message');

module.exports = async (req, res) => {
    try {
        const { merchantId, pageKey } = req.params;
        const key = normalizePageKey(pageKey);
        if (!merchantId?.trim() || !key) {
            res.status(400).json({ error: 'merchantId 或 pageKey 無效' });
            return;
        }

        const result = await deletePage(merchantId.trim(), key);
        if (result.status === 'not_found') {
            res.status(404).json({ error: '找不到專案' });
            return;
        }
        if (result.status === 'already_deleted') {
            res.status(200).json({ ok: true, alreadyDeleted: true });
            return;
        }

        res.status(200).json({ ok: true, page: result.page });
    } catch (error) {
        console.error('[crowdfunding delete]', error);
        res.status(500).json({
            error: getSafeApiErrorMessage(error, '刪除大型募資專案失敗'),
        });
    }
};
