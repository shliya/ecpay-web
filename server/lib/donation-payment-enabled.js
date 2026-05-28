/**
 * 一般斗內與大型募資斗內使用不同的金流開關欄位。
 * @param {object|null|undefined} config
 * @param {'ecpay'|'payuni'|'opay'} provider
 * @param {boolean} isLargeCrowdfunding
 */
function isDonationPaymentEnabled(config, provider, isLargeCrowdfunding) {
    const c = config || {};
    if (isLargeCrowdfunding) {
        if (provider === 'ecpay') {
            return c.lcfEcpayEnabled !== false;
        }
        if (provider === 'payuni') {
            return c.lcfPayuniEnabled !== false;
        }
        if (provider === 'opay') {
            return c.lcfOpayEnabled !== false;
        }
    } else {
        if (provider === 'ecpay') {
            return c.ecpayEnabled !== false;
        }
        if (provider === 'payuni') {
            return c.payuniEnabled !== false;
        }
        if (provider === 'opay') {
            return c.opayEnabled !== false;
        }
    }
    return true;
}

module.exports = { isDonationPaymentEnabled };
