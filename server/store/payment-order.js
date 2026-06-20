const { Op } = require('sequelize');
const PaymentPendingOrder = require('../model/schema/payment-pending-order');
const { PAYMENT_PENDING_STATUS } = require('../lib/payment-pending-status');

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
        status: plain.status || PAYMENT_PENDING_STATUS.PENDING,
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
    const { createdAt: _omit, kind: kindFromMeta, status: _status, ...meta } =
        info;
    const kind = String(kindFromMeta || info.kind || '').slice(0, 30);
    const now = new Date();
    const expiresAt = new Date(now.getTime() + PENDING_ORDER_TTL_MS);

    await PaymentPendingOrder.upsert({
        merchantTradeNo: tradeNo,
        kind,
        meta,
        status: PAYMENT_PENDING_STATUS.PENDING,
        created_at: now,
        expires_at: expiresAt,
    });
}

/**
 * 進行中預存（一番賞鎖卡、建單後未逾時）
 * @param {string} merchantTradeNo
 * @returns {Promise<object|null>}
 */
async function getPaymentOrder(merchantTradeNo) {
    const tradeNo = String(merchantTradeNo || '').trim();
    if (!tradeNo) {
        return null;
    }

    const row = await PaymentPendingOrder.findOne({
        where: {
            merchantTradeNo: tradeNo,
            status: PAYMENT_PENDING_STATUS.PENDING,
        },
    });
    if (!row) {
        return null;
    }

    const plain = row.get({ plain: true });
    if (plain.expires_at && new Date(plain.expires_at).getTime() < Date.now()) {
        return null;
    }

    return rowToOrderInfo(row);
}

/**
 * 金流回調用：含 pending / expired，保留 meta 供斗內入帳
 * @param {string} merchantTradeNo
 * @returns {Promise<object|null>}
 */
async function getPaymentOrderForCallback(merchantTradeNo) {
    const tradeNo = String(merchantTradeNo || '').trim();
    if (!tradeNo) {
        return null;
    }

    const row = await PaymentPendingOrder.findOne({
        where: {
            merchantTradeNo: tradeNo,
            status: {
                [Op.in]: [
                    PAYMENT_PENDING_STATUS.PENDING,
                    PAYMENT_PENDING_STATUS.EXPIRED,
                    PAYMENT_PENDING_STATUS.COMPLETED,
                ],
            },
        },
    });
    if (!row) {
        return null;
    }

    return rowToOrderInfo(row);
}

async function getPaymentOrderByEventAndCard(eventId, cardIndex, clientId) {
    const rows = await PaymentPendingOrder.findAll({
        where: {
            status: PAYMENT_PENDING_STATUS.PENDING,
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
            status: PAYMENT_PENDING_STATUS.PENDING,
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

async function markPaymentOrderExpired(merchantTradeNo) {
    const tradeNo = String(merchantTradeNo || '').trim();
    if (!tradeNo) {
        return false;
    }
    const [count] = await PaymentPendingOrder.update(
        { status: PAYMENT_PENDING_STATUS.EXPIRED },
        {
            where: {
                merchantTradeNo: tradeNo,
                status: PAYMENT_PENDING_STATUS.PENDING,
            },
        }
    );
    return count > 0;
}

async function markPaymentOrderCompleted(merchantTradeNo) {
    const tradeNo = String(merchantTradeNo || '').trim();
    if (!tradeNo) {
        return false;
    }
    const [count] = await PaymentPendingOrder.update(
        { status: PAYMENT_PENDING_STATUS.COMPLETED },
        {
            where: {
                merchantTradeNo: tradeNo,
                status: {
                    [Op.in]: [
                        PAYMENT_PENDING_STATUS.PENDING,
                        PAYMENT_PENDING_STATUS.EXPIRED,
                    ],
                },
            },
        }
    );
    return count > 0;
}

/**
 * 入帳失敗時還原 completed，供金流重試（僅限剛搶鎖的單筆）
 * @param {string} merchantTradeNo
 * @param {string} targetStatus pending | expired
 */
async function revertPaymentOrderFromCompleted(merchantTradeNo, targetStatus) {
    const tradeNo = String(merchantTradeNo || '').trim();
    if (!tradeNo) {
        return false;
    }
    const status =
        targetStatus === PAYMENT_PENDING_STATUS.EXPIRED
            ? PAYMENT_PENDING_STATUS.EXPIRED
            : PAYMENT_PENDING_STATUS.PENDING;
    const [count] = await PaymentPendingOrder.update(
        { status },
        {
            where: {
                merchantTradeNo: tradeNo,
                status: PAYMENT_PENDING_STATUS.COMPLETED,
            },
        }
    );
    return count > 0;
}

async function markPaymentOrderFailed(merchantTradeNo) {
    const tradeNo = String(merchantTradeNo || '').trim();
    if (!tradeNo) {
        return false;
    }
    const [count] = await PaymentPendingOrder.update(
        { status: PAYMENT_PENDING_STATUS.FAILED },
        {
            where: {
                merchantTradeNo: tradeNo,
                status: {
                    [Op.in]: [
                        PAYMENT_PENDING_STATUS.PENDING,
                        PAYMENT_PENDING_STATUS.EXPIRED,
                    ],
                },
            },
        }
    );
    return count > 0;
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
    PAYMENT_PENDING_STATUS,
    setPaymentOrder,
    getPaymentOrder,
    getPaymentOrderForCallback,
    getPaymentOrderByEventAndCard,
    getAllPaymentOrders,
    markPaymentOrderExpired,
    markPaymentOrderCompleted,
    revertPaymentOrderFromCompleted,
    markPaymentOrderFailed,
    deletePaymentOrder,
};
