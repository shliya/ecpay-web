const { safeEqualString } = require('./safe-equal');

/**
 * 以金流 Hash Key 證明擁有該商店（TOTP 綁定前）
 * @param {object} config ecpay_config row
 * @param {{ hashKey?: string, payuniHashKey?: string }} proof
 * @returns {boolean}
 */
function verifyMerchantKeyOwnership(config, proof) {
    if (!config || !proof || typeof proof !== 'object') {
        return false;
    }

    const hashKey = String(proof.hashKey || '').trim();
    const payuniHashKey = String(proof.payuniHashKey || '').trim();

    const storedEcpay = String(config.hashKey || '').trim();
    if (hashKey && storedEcpay && safeEqualString(hashKey, storedEcpay)) {
        return true;
    }

    const storedPayuni = String(config.payuniHashKey || '').trim();
    if (
        payuniHashKey &&
        storedPayuni &&
        safeEqualString(payuniHashKey, storedPayuni)
    ) {
        return true;
    }

    return false;
}

module.exports = {
    verifyMerchantKeyOwnership,
};
