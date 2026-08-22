const { getPublicDonationsByMerchantId } = require('../../service/donation');

/**
 * 公開斗內列表（不需 TOTP）。
 * 僅回傳暱稱／金額／留言／時間，不含 id、merchantId、ecpayConfigId 等內部欄位。
 */
module.exports = async (req, res) => {
    try {
        const merchantId = String(req.params.merchantId || '').trim();
        if (!merchantId) {
            res.status(400).json({ error: '缺少 merchantId' });
            return;
        }

        try {
            const donations = await getPublicDonationsByMerchantId(merchantId);
            res.json(donations);
        } catch (error) {
            // 商店不存在／尚無資料一律回空陣列
            if (
                error.code === 'ENOENT' ||
                error.message === 'Ecpay config not found'
            ) {
                res.json([]);
                return;
            }
            throw error;
        }
    } catch (error) {
        console.error('[donations public] 取得公開斗內列表失敗:', error);
        res.status(500).json({ error: '伺服器錯誤' });
    }
};
