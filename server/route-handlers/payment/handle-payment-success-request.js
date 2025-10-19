const IchibanCardStore = require('../../store/ichiban-card');
const IchibanEventStore = require('../../store/ichiban-event');
const { ENUM_ICHIBAN_CARD_STATUS } = require('../../lib/enum');
const { ichibanWebSocketServer } = global;
const {
    getPaymentOrder,
    deletePaymentOrder,
} = require('../../store/payment-order');
const { ENUM_ICHIBAN_EVENT_STATUS } = require('../../lib/enum');

module.exports = async (req, res) => {
    try {
        const { MerchantTradeNo, TradeNo, PaymentDate, TotalAmount } = req.body;

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
                // 更新卡片狀態為已開啟
                await IchibanCardStore.updateIchibanCardByIdAndStatus(card.id, {
                    status: ENUM_ICHIBAN_CARD_STATUS.OPENED,
                    openedAt: new Date(),
                    openedBy: clientId,
                });

                // 更新活動統計
                await IchibanEventStore.incrementOpenedCards(eventId);

                const prizeName = card.prize?.prizeName || '未知獎品';

                ichibanWebSocketServer.broadcastToEvent(eventId, {
                    type: 'card-opened',
                    eventId: eventId,
                    cardIndex: cardIndex,
                    prizeName: prizeName,
                    openedBy: clientId,
                    timestamp: new Date().toISOString(),
                });

                ichibanWebSocketServer.broadcastToRoom(
                    `merchant-${merchantId}`,
                    {
                        type: 'card-opened-notification',
                        eventId: eventId,
                        cardIndex: cardIndex,
                        prizeName: prizeName,
                        openedBy: clientId,
                        timestamp: new Date().toISOString(),
                    }
                );

                // 檢查活動是否已結束
                const event =
                    await IchibanEventStore.getIchibanEventByIdAndMerchantId(
                        eventId,
                        merchantId
                    );
                if (event && event.status === ENUM_ICHIBAN_EVENT_STATUS.ENDED) {
                    ichibanWebSocketServer.broadcastToEvent(eventId, {
                        type: 'event-ended',
                        eventId: eventId,
                        message: '活動已結束 - 所有卡片都已開啟',
                        timestamp: new Date().toISOString(),
                    });

                    ichibanWebSocketServer.broadcastToRoom(
                        `merchant-${merchantId}`,
                        {
                            type: 'event-ended-notification',
                            eventId: eventId,
                            message: '活動已結束 - 所有卡片都已開啟',
                            timestamp: new Date().toISOString(),
                        }
                    );
                }
            }

            // 清理訂單資訊
            deletePaymentOrder(MerchantTradeNo);
        }

        res.status(200).send('1|OK');
    } catch (error) {
        console.error('付款成功回調處理錯誤:', error);
        res.status(500).send('0|ERROR');
    }
};
