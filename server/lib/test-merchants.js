const TEST_MERCHANT_IDS = new Set(['3002599', 'S008915545']);

function isTestMerchantId(merchantId) {
    if (!merchantId) {
        return false;
    }
    return TEST_MERCHANT_IDS.has(String(merchantId).trim());
}

module.exports = {
    isTestMerchantId,
};

