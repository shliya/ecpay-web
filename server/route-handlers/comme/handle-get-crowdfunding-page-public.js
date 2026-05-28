const {
    getPublicPageByPageKey,
} = require('../../service/large-crowdfunding-page');
const { getSafeApiErrorMessage } = require('../../lib/safe-error-message');

module.exports = async (req, res) => {
    try {
        const { pageKey, merchantId } = req.params;
        const result = await getPublicPageByPageKey(pageKey, merchantId);

        if (result.status === 'invalid_key') {
            res.status(400).json({ error: 'pageKey 無效', code: 'invalid_key' });
            return;
        }
        if (result.status === 'not_found') {
            res.status(404).json({
                error: '找不到大型募資頁面',
                code: 'not_found',
            });
            return;
        }
        if (result.status === 'not_published') {
            res.status(403).json({
                error: '此募資頁尚未發布，請至後台按「發布」後再開啟公開連結',
                code: 'not_published',
            });
            return;
        }

        res.status(200).json(result.data);
    } catch (error) {
        console.error('[crowdfunding GET public]', error);
        res.status(500).json({
            error: getSafeApiErrorMessage(error, '取得募資頁面失敗'),
        });
    }
};
