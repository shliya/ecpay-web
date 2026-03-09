const {
    updateFundraisingEventByIdAndMerchantId,
} = require('../../service/fundraising-events');
const { getSafeApiErrorMessage } = require('../../lib/safe-error-message');

module.exports = async (req, res) => {
    try {
        const { merchantId, id } = req.params;
        const { eventName } = req.body;

        await updateFundraisingEventByIdAndMerchantId(id, merchantId, {
            eventName,
        });

        res.sendStatus(200);
    } catch (error) {
        console.error('更新募資活動時發生錯誤:', error);
        res.status(500).json({ error: getSafeApiErrorMessage(error) });
    }
};
