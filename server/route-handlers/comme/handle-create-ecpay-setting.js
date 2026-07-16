const { createEcpayConfig } = require('../../service/ecpay-config');
const {
    assertRegistrationAllowed,
} = require('../../lib/registration-guard');

module.exports = async (req, res) => {
    try {
        const gate = assertRegistrationAllowed(req);
        if (!gate.ok) {
            return res.status(gate.status).json({ message: gate.message });
        }

        const { merchantId, hashKey, hashIV } = req.body;

        if (!merchantId || !hashKey || !hashIV) {
            return res.status(400).json({ message: '所有欄位都是必填的' });
        }
        const result = await createEcpayConfig({ merchantId, hashKey, hashIV });

        res.status(200).json({ message: '設定已儲存', id: result.id });
    } catch (error) {
        console.error('儲存設定時發生錯誤:', error);
        res.status(500).json({ message: '伺服器錯誤' });
    }
};
