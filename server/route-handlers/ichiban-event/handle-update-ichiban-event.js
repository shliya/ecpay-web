const {
    updateIchibanEventByIdAndMerchantId,
} = require('../../service/ichiban-event');

module.exports = async (req, res) => {
    try {
        const { id, merchantId } = req.params;
        const { eventName, description, totalCards } = req.body;

        try {
            await updateIchibanEventByIdAndMerchantId(id, merchantId, {
                eventName,
                description,
                totalCards,
            });

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
