const {
    updateIchibanEventByIdAndMerchantId,
} = require('../../service/ichiban-event');
const { getSafeApiErrorMessage } = require('../../lib/safe-error-message');

module.exports = async (req, res) => {
    try {
        const { id, merchantId } = req.params;
        const { eventName, description, totalCards } = req.body;

        await updateIchibanEventByIdAndMerchantId(id, merchantId, {
            eventName,
            description,
            totalCards,
        });

        res.sendStatus(200);
    } catch (error) {
        console.error('更新一番賞活動時發生錯誤:', error);
        res.status(500).json({ error: getSafeApiErrorMessage(error) });
    }
};
