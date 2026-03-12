const {
    pauseFundraisingEventByIdAndMerchantId,
} = require('../../service/fundraising-events');
const { getSafeApiErrorMessage } = require('../../lib/safe-error-message');

module.exports = async (req, res) => {
    try {
        const { merchantId, id } = req.params;
        await pauseFundraisingEventByIdAndMerchantId(id, merchantId);
        res.sendStatus(200);
    } catch (error) {
        console.error('暫停募資活動時發生錯誤:', error);
        res.status(500).json({ error: getSafeApiErrorMessage(error) });
    }
};
