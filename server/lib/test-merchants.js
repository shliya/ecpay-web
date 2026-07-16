/**
 * 測試商店 TOTP 繞過僅允許非 production，或明確開啟 ALLOW_TEST_MERCHANT_TOTP_BYPASS=true
 */
const TEST_MERCHANT_IDS = new Set(['3002599', 'S008915545']);

function isTestMerchantBypassEnabled() {
    if (process.env.ALLOW_TEST_MERCHANT_TOTP_BYPASS === 'true') {
        return true;
    }
    return process.env.NODE_ENV !== 'production';
}

function isTestMerchantId(merchantId) {
    if (!merchantId || !isTestMerchantBypassEnabled()) {
        return false;
    }
    return TEST_MERCHANT_IDS.has(String(merchantId).trim());
}

module.exports = {
    isTestMerchantId,
    isTestMerchantBypassEnabled,
    TEST_MERCHANT_IDS,
};
