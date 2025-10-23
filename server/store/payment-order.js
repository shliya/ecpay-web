const paymentOrders = new Map();

function setPaymentOrder(merchantTradeNo, orderInfo) {
    paymentOrders.set(merchantTradeNo, {
        ...orderInfo,
        createdAt: Date.now(), // 使用時間戳而不是 Date 對象
    });
}

function getPaymentOrder(merchantTradeNo) {
    const orderInfo = paymentOrders.get(merchantTradeNo);
    if (orderInfo) {
        console.log(`找到付款訂單: ${merchantTradeNo}`, orderInfo);
    } else {
        console.log(`未找到付款訂單: ${merchantTradeNo}`);
    }
    return orderInfo;
}

function getAllPaymentOrders() {
    return paymentOrders;
}

function deletePaymentOrder(merchantTradeNo) {
    const deleted = paymentOrders.delete(merchantTradeNo);
    if (deleted) {
        console.log(`付款訂單已刪除: ${merchantTradeNo}`);
    } else {
        console.log(`付款訂單不存在: ${merchantTradeNo}`);
    }
    return deleted;
}

module.exports = {
    setPaymentOrder,
    getPaymentOrder,
    getAllPaymentOrders,
    deletePaymentOrder,
};
