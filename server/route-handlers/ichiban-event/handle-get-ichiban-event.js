const {
    getIchibanEventByIdAndMerchantId,
} = require('../../service/ichiban-event');

module.exports = async (req, res) => {
    try {
        const { id, merchantId } = req.params;

        if (!merchantId) {
            return res.status(400).json({ error: 'merchantId is required' });
        }

        try {
            const event = await getIchibanEventByIdAndMerchantId(
                id,
                merchantId
            );

            if (!event) {
                return res.status(404).json({ error: 'Event not found' });
            }

            res.json(event);
        } catch (error) {
            if (error.code === 'ENOENT') {
                res.status(404).json({ error: 'Event not found' });
            } else {
                throw error;
            }
        }
    } catch (error) {
        console.error('檢查商店時發生錯誤:', error);
        res.status(500).json({ error: error.message });
    }
};
