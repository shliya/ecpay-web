const {
    getFundraisingEventByIdAndMerchantId,
} = require('../../service/fundraising-events');
const { getSafeApiErrorMessage } = require('../../lib/safe-error-message');

module.exports = async (req, res) => {
    try {
        const { id, merchantId } = req.params;
        const event = await getFundraisingEventByIdAndMerchantId(
            id,
            merchantId
        );

        if (!event) {
            return res.status(404).json({ error: '活動不存在' });
        }

        res.json(event);
    } catch (error) {
        console.error('取得募資活動時發生錯誤:', error);
        res.status(500).json({ error: getSafeApiErrorMessage(error) });
    }
};
