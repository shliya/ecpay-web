const { getEcpayConfigByMerchantId } = require('../store/ecpay-config');

/**
 * WebSocket 房間名為 merchant-${id}，前端一律用綠界特店代號連線。
 * PAYUNi / OPay 回調的 merchantId 可能為各金流 MerID，需對應到 ecpay_config.merchantId。
 * @param {string|{ merchantId?: string }} merchantIdOrRow
 * @returns {Promise<string|null>}
 */
async function resolveMerchantIdForWebSocket(merchantIdOrRow) {
    const key =
        merchantIdOrRow != null && typeof merchantIdOrRow === 'object'
            ? String(merchantIdOrRow.merchantId || '').trim()
            : String(merchantIdOrRow || '').trim();
    if (!key) {
        return null;
    }
    const config = await getEcpayConfigByMerchantId(key);
    if (!config) {
        return key;
    }
    if (config.merchantId && String(config.merchantId).trim()) {
        return String(config.merchantId).trim();
    }
    if (config.payuniMerchantId && String(config.payuniMerchantId).trim()) {
        return String(config.payuniMerchantId).trim();
    }
    if (config.opayMerchantId && String(config.opayMerchantId).trim()) {
        return String(config.opayMerchantId).trim();
    }
    return key;
}

/**
 * 推播 new-donation 至 overlay / donate-list 等 WebSocket 訂閱端
 * @param {object} params
 * @param {string|{ merchantId?: string }} params.merchantId
 * @param {string} params.name
 * @param {number} params.cost
 * @param {string} [params.message]
 * @param {number} params.donationType ENUM_DONATION_TYPE
 * @param {object} [params.videoTask]
 */
async function broadcastNewDonation({
    merchantId,
    name,
    cost,
    message = '',
    donationType,
    videoTask,
}) {
    const { ichibanWebSocketServer } = global;
    if (!ichibanWebSocketServer) {
        return;
    }

    const wsMerchantId = await resolveMerchantIdForWebSocket(merchantId);
    if (!wsMerchantId) {
        return;
    }

    const wsPayload = {
        type: 'new-donation',
        name,
        cost,
        message: message || '',
        donationType,
        timestamp: new Date().toISOString(),
    };
    if (videoTask) {
        wsPayload.videoTask = videoTask;
    }

    ichibanWebSocketServer.broadcastToMerchant(wsMerchantId, wsPayload);
}

module.exports = {
    resolveMerchantIdForWebSocket,
    broadcastNewDonation,
};
