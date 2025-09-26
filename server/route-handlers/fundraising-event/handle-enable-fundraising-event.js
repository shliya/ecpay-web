const {
    enableFundraisingEventByIdAndMerchantId,
} = require('../../service/fundraising-events');

module.exports = async (req, res) => {
    try {
        const { merchantId, id } = req.params;

        try {
            await enableFundraisingEventByIdAndMerchantId(id, merchantId);

            res.sendStatus(201);
        } catch (error) {
            if (error.code === 'ENOENT') {
                res.json([]);
            } else {
                throw error;
            }
        }
    } catch (error) {
        console.error('檢查商店時發生錯誤:', error);
        res.status(500).json({ error: error.message });
    }
};
