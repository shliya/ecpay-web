const {
    getFundraisingEventByIdAndMerchantId,
} = require('../../service/fundraising-events');

module.exports = async (req, res) => {
    try {
        const { id, merchantId } = req.params;

        try {
            const event = await getFundraisingEventByIdAndMerchantId(
                id,
                merchantId
            );

            res.json(event);
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
