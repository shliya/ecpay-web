const { getEcpayConfigByMerchantId } = require('../store/ecpay-config');

/**
 * @param {object|null|undefined} config
 * @returns {boolean}
 */
function isLargeCrowdfundingEnabledFromConfig(config) {
    return config != null && config.largeCrowdfundingEnabled === true;
}

/**
 * @param {string} merchantId
 * @returns {Promise<boolean>}
 */
async function isLargeCrowdfundingEnabledForMerchant(merchantId) {
    const mid = String(merchantId || '').trim();
    if (!mid) {
        return false;
    }
    const config = await getEcpayConfigByMerchantId(mid);
    return isLargeCrowdfundingEnabledFromConfig(config);
}

/**
 * @param {import('express').Response} res
 * @param {string} merchantId
 * @returns {Promise<boolean>} true = 已開放可繼續
 */
async function rejectIfLargeCrowdfundingDisabled(res, merchantId) {
    if (await isLargeCrowdfundingEnabledForMerchant(merchantId)) {
        return true;
    }
    res.status(403).json({ error: '此商店未開放大型募資功能' });
    return false;
}

module.exports = {
    isLargeCrowdfundingEnabledFromConfig,
    isLargeCrowdfundingEnabledForMerchant,
    rejectIfLargeCrowdfundingDisabled,
};
