const { getDonationsByMerchantId } = require('../../store/donation');

module.exports = async (req, res) => {
    try {
        const { merchantId } = req.params;

        try {
            const donations = await getDonationsByMerchantId(merchantId);

            res.json(donations);
        } catch (error) {
            if (error.code === 'ENOENT') {
                res.json([]);
            } else {
                throw error;
            }
        }
    } catch (error) {
        console.error('檢查商店時發生錯誤:', error);
        res.status(500).json({ error: '伺服器錯誤' });
    }
};
