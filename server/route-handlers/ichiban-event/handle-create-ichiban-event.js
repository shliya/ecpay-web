const { createIchibanEvent } = require('../../service/ichiban-event');

module.exports = async (req, res) => {
    try {
        const {
            merchantId,
            eventName,
            description,
            totalCards,
            startTime,
            endTime,
            prizes,
        } = req.body;

        if (!merchantId || !eventName || !totalCards || !prizes) {
            return res.status(400).json({ message: '有缺的欄位' });
        }

        await createIchibanEvent({
            merchantId,
            eventName,
            description,
            totalCards,
            startTime,
            endTime,
            prizes,
        });

        res.status(200).json({ message: '設定已儲存' });
    } catch (error) {
        console.error('儲存設定時發生錯誤:', error);
        res.status(500).json({ message: '伺服器錯誤' });
    }
};
