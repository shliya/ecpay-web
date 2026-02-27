const IchibanCardStore = require('../../store/ichiban-card');
const IchibanEventStore = require('../../store/ichiban-event');
const IchibanEventService = require('../../service/ichiban-event');
const { ENUM_ICHIBAN_CARD_STATUS } = require('../../lib/enum');
const { ichibanWebSocketServer } = global;
const {
    getPaymentOrder,
    deletePaymentOrder,
} = require('../../store/payment-order');
const { ENUM_ICHIBAN_EVENT_STATUS } = require('../../lib/enum');
const {
    getEcpayConfigByMerchantId,
    getAllEcpayConfigs,
} = require('../../store/ecpay-config');
const { createDonation } = require('../../service/donation');
const {
    parseDonationCallback,
    parseUrlDonationCallback,
} = require('../../lib/payment-providers/ecpay');

module.exports = async (req, res) => {
    try {
        if (process.env.NODE_ENV !== 'production') {
            console.log('[ecpay-success] 收到回調', {
                hasBody: !!req.body,
                keys: req.body ? Object.keys(req.body) : [],
            });
        }

        const {
            MerchantTradeNo,
            TradeNo,
            PaymentDate,
            TotalAmount,
            MerchantID,
            CustomField1,
        } = req.body || {};

        const orderInfo = getPaymentOrder(MerchantTradeNo);

        if (orderInfo) {
            const { eventId, cardIndex, clientId, merchantId, nickname } =
                orderInfo;

            const card =
                await IchibanCardStore.getIchibanCardByEventIdAndCardIndexAndStatus(
                    eventId,
                    cardIndex,
                    ENUM_ICHIBAN_CARD_STATUS.LOCKED
                );

            if (card) {
                await IchibanCardStore.updateIchibanCardByIdAndStatus(card.id, {
                    status: ENUM_ICHIBAN_CARD_STATUS.OPENED,
                    openedAt: new Date(),
                    openedBy: CustomField1,
                });

                await IchibanEventService.incrementOpenedCards(eventId);

                const prizeName = card.prize?.prizeName || '未知獎品';

                ichibanWebSocketServer.broadcastToEvent(eventId, {
                    type: 'card-opened',
                    eventId: eventId,
                    cardIndex: cardIndex,
                    prizeName: prizeName,
                    openedBy: CustomField1,
                    openedByClientId: clientId,
                    timestamp: new Date().toISOString(),
                });

                ichibanWebSocketServer.broadcastToRoom(
                    `merchant-${merchantId}`,
                    {
                        type: 'card-opened-notification',
                        eventId: eventId,
                        cardIndex: cardIndex,
                        prizeName: prizeName,
                        openedBy: CustomField1,
                        openedByClientId: clientId,
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
        } else {
            // 無一番賞訂單：視為斗內回調，寫入 donations
            if (process.env.NODE_ENV !== 'production') {
                console.log('[ecpay-success] 無一番賞訂單，當作斗內回調處理');
            }
            const body = req.body || {};
            const merchantId = MerchantID || body.MerchantID;
            const config = merchantId
                ? await getEcpayConfigByMerchantId(merchantId)
                : null;

            let row = null;
            if (body.Data) {
                row = config
                    ? parseDonationCallback(body, {
                          hashKey: config.hashKey,
                          hashIV: config.hashIV,
                      })
                    : null;
                if (!row && body.Data) {
                    const configs = await getAllEcpayConfigs();
                    for (const c of configs) {
                        row = parseDonationCallback(body, {
                            hashKey: c.hashKey,
                            hashIV: c.hashIV,
                        });
                        if (row) break;
                    }
                }
            } else {
                row = parseUrlDonationCallback(body, config || undefined);
            }

            if (row) {
                await createDonation(row);
                if (process.env.NODE_ENV !== 'production') {
                    console.log(
                        '[ecpay-success] 已寫入 donation',
                        row.merchantId,
                        row.cost
                    );
                }
            } else if (process.env.NODE_ENV !== 'production') {
                console.log(
                    '[ecpay-success] 未寫入 donation: merchantId=',
                    merchantId,
                    'hasData=',
                    !!body.Data,
                    'config=',
                    !!config
                );
            }
        }

        res.status(200).send('1|OK');
    } catch (error) {
        console.error('付款成功回調處理錯誤:', error);
        res.status(500).send('0|ERROR');
    }
};
