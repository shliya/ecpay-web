const { getEcpayConfigByMerchantId } = require('../../store/ecpay-config');

module.exports = async (req, res) => {
    try {
        const { merchantId } = req.params;

        try {
            const result = await getEcpayConfigByMerchantId(merchantId);
            if (result === null) {
                throw new Error('商店不存在');
            }
            res.json({ exists: true });
        } catch {
            res.json({ exists: false });
        }
    } catch (error) {
        console.error('檢查商店時發生錯誤:', error);
        res.status(500).json({ error: '伺服器錯誤' });
    }
};
