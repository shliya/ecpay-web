const { isTestMerchantId } = require('../../lib/test-merchants');

module.exports = async (req, res, next) => {
    try {
        const { merchantId } = req.params;
        if (!isTestMerchantId(merchantId)) {
            next();
            return;
        }
        res.status(200).json({});
    } catch (error) {
        console.error('[before-check-test-account]', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};
