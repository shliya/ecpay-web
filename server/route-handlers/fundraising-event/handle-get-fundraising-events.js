const {
    getActiveFundraisingEventsByMerchantId,
} = require('../../service/fundraising-events');
const { getSafeApiErrorMessage } = require('../../lib/safe-error-message');

module.exports = async (req, res) => {
    try {
        const { merchantId } = req.params;
        const events = await getActiveFundraisingEventsByMerchantId(merchantId);
        res.json(events);
    } catch (error) {
        console.error('取得募資活動列表時發生錯誤:', error);
        res.status(500).json({ error: getSafeApiErrorMessage(error) });
    }
};
