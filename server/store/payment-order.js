const { Op } = require('sequelize');
const PaymentPendingOrder = require('../model/schema/payment-pending-order');

const PENDING_ORDER_TTL_MS = 30 * 60 * 1000;

function rowToOrderInfo(row) {
    if (!row) {
        return null;
    }
    const plain = typeof row.get === 'function' ? row.get({ plain: true }) : row;
    const meta =
        plain.meta && typeof plain.meta === 'object' ? plain.meta : {};
    const createdAt = plain.created_at
        ? new Date(plain.created_at).getTime()
        : Date.now();
    return {
        ...meta,
        kind: plain.kind || meta.kind,
        createdAt,
    };
}

/**
 * @param {string} merchantTradeNo
 * @param {object} orderInfo
 */
async function setPaymentOrder(merchantTradeNo, orderInfo) {
    const tradeNo = String(merchantTradeNo || '').trim();
    if (!tradeNo) {
        throw new Error('merchantTradeNo 為必填');
    }

    const info = orderInfo && typeof orderInfo === 'object' ? orderInfo : {};
    const { createdAt: _omit, kind: kindFromMeta, ...meta } = info;
    const kind = String(kindFromMeta || info.kind || '').slice(0, 30);
    const now = new Date();
    const expiresAt = new Date(now.getTime() + PENDING_ORDER_TTL_MS);

    await PaymentPendingOrder.upsert({
        merchantTradeNo: tradeNo,
        kind,
        meta,
        created_at: now,
        expires_at: expiresAt,
    });
}

/**
 * @param {string} merchantTradeNo
 * @returns {Promise<object|null>}
 */
async function getPaymentOrder(merchantTradeNo) {
    const tradeNo = String(merchantTradeNo || '').trim();
    if (!tradeNo) {
        return null;
    }

    const row = await PaymentPendingOrder.findByPk(tradeNo);
    if (!row) {
        return null;
    }

    const plain = row.get({ plain: true });
    if (plain.expires_at && new Date(plain.expires_at).getTime() < Date.now()) {
        return null;
    }

    return rowToOrderInfo(row);
}

async function getPaymentOrderByEventAndCard(eventId, cardIndex, clientId) {
    const rows = await PaymentPendingOrder.findAll({
        where: {
            expires_at: { [Op.gt]: new Date() },
        },
        order: [['created_at', 'DESC']],
        limit: 200,
    });

    for (const row of rows) {
        const info = rowToOrderInfo(row);
        if (
            info &&
            info.eventId === eventId &&
            info.cardIndex === cardIndex &&
            info.clientId === clientId
        ) {
            return {
                merchantTradeNo: row.merchantTradeNo,
                ...info,
            };
        }
    }
    return null;
}

/**
 * 供 timeout worker 使用，回傳 Map 相容舊介面
 * @returns {Promise<Map<string, object>>}
 */
async function getAllPaymentOrders() {
    const rows = await PaymentPendingOrder.findAll({
        where: {
            expires_at: { [Op.gt]: new Date() },
        },
    });

    const map = new Map();
    for (const row of rows) {
        const info = rowToOrderInfo(row);
        if (info) {
            map.set(row.merchantTradeNo, info);
        }
    }
    return map;
}

async function deletePaymentOrder(merchantTradeNo) {
    const tradeNo = String(merchantTradeNo || '').trim();
    if (!tradeNo) {
        return false;
    }
    const count = await PaymentPendingOrder.destroy({
        where: { merchantTradeNo: tradeNo },
    });
    return count > 0;
}

module.exports = {
    PENDING_ORDER_TTL_MS,
    setPaymentOrder,
    getPaymentOrder,
    getPaymentOrderByEventAndCard,
    getAllPaymentOrders,
    deletePaymentOrder,
};
