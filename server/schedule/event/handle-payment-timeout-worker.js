const IchibanCardService = require('../../service/ichiban-card');
const { ENUM_ICHIBAN_CARD_STATUS } = require('../../lib/enum');
const { ichibanWebSocketServer } = global;
const { getAllPaymentOrders } = require('../../store/payment-order');
const { deletePaymentOrder } = require('../../store/payment-order');

async function handlePaymentTimeoutWorker(taskName) {
    try {
        console.log(`[${taskName}] 開始檢查付款超時...`);

        const paymentOrders = getAllPaymentOrders();

        if (!paymentOrders || paymentOrders.size === 0) {
            console.log(`[${taskName}] 沒有待處理的付款訂單`);
            return;
        }

        const currentTime = Date.now();
        const timeoutDuration = 5 * 60 * 1000; // 5分鐘
        let timeoutCount = 0;

        for (const [merchantTradeNo, orderInfo] of paymentOrders.entries()) {
            const { eventId, cardIndex, clientId, merchantId, createdAt } =
                orderInfo;

            if (currentTime - createdAt > timeoutDuration) {
                try {
                    console.log(
                        `[${taskName}] 處理超時付款: ${merchantTradeNo}`
                    );

                    const card =
                        await IchibanCardService.getIchibanCardByEventIdAndCardIndexAndStatusWithLock(
                            eventId,
                            cardIndex,
                            ENUM_ICHIBAN_CARD_STATUS.LOCKED
                        );

                    if (card) {
                        await IchibanCardService.updateIchibanCardByIdAndStatus(
                            card.id,
                            {
                                status: ENUM_ICHIBAN_CARD_STATUS.CLOSED,
                                openedAt: null,
                                openedBy: null,
                            }
                        );
                        // 廣播付款超時訊息
                        if (ichibanWebSocketServer) {
                            ichibanWebSocketServer.broadcastToEvent(eventId, {
                                type: 'card-payment-failed',
                                eventId: eventId,
                                cardIndex: cardIndex,
                                clientId: clientId,
                                timestamp: new Date().toISOString(),
                                reason: 'payment-timeout',
                            });

                            ichibanWebSocketServer.broadcastToRoom(
                                `merchant-${merchantId}`,
                                {
                                    type: 'card-payment-failed-notification',
                                    eventId: eventId,
                                    cardIndex: cardIndex,
                                    clientId: clientId,
                                    timestamp: new Date().toISOString(),
                                    reason: 'payment-timeout',
                                }
                            );
                        }

                        console.log(
                            `[${taskName}] 卡片 ${cardIndex} 付款超時，已恢復為可點擊狀態`
                        );
                        timeoutCount++;
                        deletePaymentOrder(merchantTradeNo);
                    }
                } catch (error) {
                    console.error(
                        `[${taskName}] 處理超時付款 ${merchantTradeNo} 時發生錯誤:`,
                        error
                    );
                }
            }
        }

        if (timeoutCount > 0) {
            console.log(`[${taskName}] 處理了 ${timeoutCount} 個超時付款`);
        } else {
            console.log(`[${taskName}] 沒有發現超時付款`);
        }

        console.log(`[${taskName}] COMPLETED`);
    } catch (error) {
        console.error(`[${taskName}] FAILED:`, error);
    }
}

module.exports = {
    handlePaymentTimeoutWorker,
};
