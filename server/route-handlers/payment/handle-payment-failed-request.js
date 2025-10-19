const IchibanCardStore = require('../../store/ichiban-card');
const { ENUM_ICHIBAN_CARD_STATUS } = require('../../lib/enum');
const { ichibanWebSocketServer } = global;
const {
    getPaymentOrder,
    deletePaymentOrder,
} = require('../../store/payment-order');

module.exports = async (req, res) => {
    try {
        const { MerchantTradeNo, TradeNo, PaymentDate, TotalAmount } = req.body;

        console.log('綠界付款失敗回調:', req.body);

        // 根據 MerchantTradeNo 找到對應的訂單資訊
        const orderInfo = getPaymentOrder(MerchantTradeNo);

        if (orderInfo) {
            const { eventId, cardIndex, clientId, merchantId } = orderInfo;

            // 找到對應的卡片
            const card =
                await IchibanCardStore.getIchibanCardByEventIdAndCardIndexAndStatus(
                    eventId,
                    cardIndex,
                    ENUM_ICHIBAN_CARD_STATUS.LOCKED
                );

            if (card) {
                // 恢復卡片狀態為可點擊
                await IchibanCardStore.updateIchibanCardByIdAndStatus(card.id, {
                    status: ENUM_ICHIBAN_CARD_STATUS.CLOSED,
                    openedAt: null,
                    openedBy: null,
                });

                console.log(`付款失敗: 卡片 ${cardIndex} 已恢復為可點擊狀態`);

                // 通知 WebSocket 客戶端付款失敗
                ichibanWebSocketServer.broadcastToEvent(eventId, {
                    type: 'card-payment-failed',
                    eventId: eventId,
                    cardIndex: cardIndex,
                    clientId: clientId,
                    timestamp: new Date().toISOString(),
                });

                ichibanWebSocketServer.broadcastToRoom(
                    `merchant-${merchantId}`,
                    {
                        type: 'card-payment-failed-notification',
                        eventId: eventId,
                        cardIndex: cardIndex,
                        clientId: clientId,
                        timestamp: new Date().toISOString(),
                    }
                );
            }

            // 清理訂單資訊
            deletePaymentOrder(MerchantTradeNo);
        }

        res.status(200).send('1|OK');
    } catch (error) {
        console.error('付款失敗回調處理錯誤:', error);
        res.status(500).send('0|ERROR');
    }
};
