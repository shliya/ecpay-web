const IchibanCardService = require('../../service/ichiban-card');
const { ENUM_ICHIBAN_CARD_STATUS } = require('../../lib/enum');
const { ichibanWebSocketServer } = global;
const {
    getAllPaymentOrders,
    markPaymentOrderExpired,
    deletePaymentOrder,
} = require('../../store/payment-order');
const { isDonationPendingKind } = require('../../lib/payment-pending-status');

async function handlePaymentTimeoutWorker(taskName) {
    try {
        console.log(`[${taskName}] 開始檢查付款超時...`);

        const paymentOrders = await getAllPaymentOrders();

        if (!paymentOrders || paymentOrders.size === 0) {
            console.log(`[${taskName}] 沒有待處理的付款訂單`);
            return;
        }

        const currentTime = Date.now();
        const timeoutDuration = 12 * 60 * 1000; // 12分鐘
        let ichibanTimeoutCount = 0;
        let staleOrderClearedCount = 0;

        for (const [merchantTradeNo, orderInfo] of paymentOrders.entries()) {
            const { eventId, cardIndex, clientId, merchantId, createdAt } =
                orderInfo;

            if (currentTime - createdAt <= timeoutDuration) {
                continue;
            }

            if (isDonationPendingKind(orderInfo.kind)) {
                await markPaymentOrderExpired(merchantTradeNo);
                staleOrderClearedCount++;
                console.log(
                    `[${taskName}] ${orderInfo.kind} 預存訂單逾時（status=expired）: ${merchantTradeNo}`
                );
                continue;
            }

            if (eventId == null || cardIndex == null) {
                await deletePaymentOrder(merchantTradeNo);
                staleOrderClearedCount++;
                console.log(
                    `[${taskName}] 無效或缺少 eventId 的預存訂單已清除: ${merchantTradeNo}`
                );
                continue;
            }

            try {
                console.log(`[${taskName}] 處理超時付款: ${merchantTradeNo}`);

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
                    ichibanTimeoutCount++;
                    await deletePaymentOrder(merchantTradeNo);
                }
            } catch (error) {
                console.error(
                    `[${taskName}] 處理超時付款 ${merchantTradeNo} 時發生錯誤:`,
                    error
                );
            }
        }

        if (ichibanTimeoutCount > 0) {
            console.log(
                `[${taskName}] 處理了 ${ichibanTimeoutCount} 個一番賞付款超時`
            );
        }
        if (staleOrderClearedCount > 0) {
            console.log(
                `[${taskName}] 已標記 ${staleOrderClearedCount} 筆逾時預存訂單（斗內 expired／無效已刪）`
            );
        }
        if (ichibanTimeoutCount === 0 && staleOrderClearedCount === 0) {
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
