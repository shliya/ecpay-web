const {
    updateFundraisingEventByIdAndMerchantId,
} = require('../../service/fundraising-events');
const { getSafeApiErrorMessage } = require('../../lib/safe-error-message');

module.exports = async (req, res) => {
    try {
        const { merchantId, id } = req.params;
        const { cost } = req.body;

        await updateFundraisingEventByIdAndMerchantId(id, merchantId, {
            cost,
        });

        res.sendStatus(200);
    } catch (error) {
        console.error('更新募資活動金額時發生錯誤:', error);
        res.status(500).json({ error: getSafeApiErrorMessage(error) });
    }
};
