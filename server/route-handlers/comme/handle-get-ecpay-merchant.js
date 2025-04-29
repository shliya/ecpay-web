const { getEcpayConfigByMerchantId } = require('../../store/ecpayConfig');

module.exports = async (req, res) => {
    try {
        const { merchantId } = req.params;

        try {
            await getEcpayConfigByMerchantId(merchantId);
            res.json({ exists: true });
        } catch {
            res.json({ exists: false });
        }
    } catch (error) {
        console.error('檢查商店時發生錯誤:', error);
        res.status(500).json({ error: '伺服器錯誤' });
    }
};
