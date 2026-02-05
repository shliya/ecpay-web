const { getEcpayConfigByDisplayName } = require('../../store/ecpay-config');

module.exports = async (req, res) => {
    try {
        const name = (req.query.name || '').trim();
        if (!name) {
            res.status(400).json({ error: '請提供 name 參數' });
            return;
        }

        const config = await getEcpayConfigByDisplayName(name);
        if (!config || !config.merchantId) {
            res.status(404).json({ error: '找不到對應的實況主' });
            return;
        }

        res.status(200).json({ merchantId: config.merchantId });
    } catch (error) {
        console.error('[resolve-name]', error);
        res.status(500).json({ error: error.message || '解析失敗' });
    }
};
