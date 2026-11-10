const { getEcpayConfigByMerchantId } = require('../store/ecpay-config');
const { parseEcpayConfigId } = require('./large-crowdfunding');

/**
 * 路由／金流代號（綠界／PAYUNi／OPay）→ ecpay_config
 * @param {string} merchantKey
 * @returns {Promise<{ ecpayConfigId: number, merchantId: string }|null>}
 */
async function resolveEcpayConfigFromMerchantKey(merchantKey) {
    const config = await getEcpayConfigByMerchantId(
        String(merchantKey || '').trim()
    );
    if (!config || config.id == null) {
        return null;
    }
    const ecpayConfigId = parseEcpayConfigId(config.id);
    const merchantId = String(config.merchantId || '').trim();
    if (ecpayConfigId == null || !merchantId) {
        return null;
    }
    return { ecpayConfigId, merchantId };
}

/**
 * 大型募資入帳：優先 pending order，其次金流解析列的 ecpayConfigId
 * @param {object} [orderInfo]
 * @param {object} [paymentRow]
 * @returns {Promise<number|null>}
 */
async function resolveEcpayConfigIdForLcfPayment(orderInfo, paymentRow) {
    const fromOrder = parseEcpayConfigId(orderInfo?.ecpayConfigId);
    const fromRow = parseEcpayConfigId(paymentRow?.ecpayConfigId);
    // 訂單的店（建單時記錄）與回調解析出的店（驗簽所用）都有值卻不同，
    // 代表有人拿別間店的金鑰結這筆單，寧可不入帳也不要猜要記給誰
    if (fromOrder != null && fromRow != null && fromOrder !== fromRow) {
        return null;
    }
    if (fromOrder != null) {
        return fromOrder;
    }
    if (fromRow != null) {
        return fromRow;
    }
    const resolved = await resolveEcpayConfigFromMerchantKey(
        paymentRow?.merchantId
    );
    return resolved ? resolved.ecpayConfigId : null;
}

module.exports = {
    resolveEcpayConfigFromMerchantKey,
    resolveEcpayConfigIdForLcfPayment,
};
