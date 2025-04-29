const sequelize = require('../../config/database');
const { createEcpayConfig } = require('../../store/ecpayConfig');

module.exports = async (req, res) => {
    try {
        const { merchantId, hashKey, hashIV } = req.body;

        if (!merchantId || !hashKey || !hashIV) {
            return res.status(400).json({ message: '所有欄位都是必填的' });
        }
        // TODO: 之後會改成service層
        const t = await sequelize.transaction();
        await createEcpayConfig(
            { merchantId, hashKey, hashIV },
            { transaction: t }
        );
        await t.commit();

        res.status(200).json({ message: '設定已儲存' });
    } catch (error) {
        console.error('儲存設定時發生錯誤:', error);
        res.status(500).json({ message: '伺服器錯誤' });
    }
};
