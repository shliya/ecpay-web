const { createFundraisingEvent } = require('../../service/fundraising-events');

module.exports = async (req, res) => {
    try {
        const {
            merchantId,
            eventName,
            startMonth,
            endMonth,
            totalAmount,
            type,
        } = req.body;

        if (
            !merchantId ||
            !eventName ||
            !startMonth ||
            !endMonth ||
            !totalAmount ||
            !type
        ) {
            return res.status(400).json({ message: '所有欄位都是必填的' });
        }

        await createFundraisingEvent({
            merchantId,
            eventName,
            startMonth,
            endMonth,
            totalAmount,
            type,
        });

        res.status(200).json({ message: '設定已儲存' });
    } catch (error) {
        console.error('儲存設定時發生錯誤:', error);
        res.status(500).json({ message: '伺服器錯誤' });
    }
};
