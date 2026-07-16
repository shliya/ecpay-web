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
} = require('../../store/ecpay-config');
const {
    processDonationFromPaymentCallback,
} = require('../../service/donation-payment-callback');
const { isDonationPendingKind } = require('../../lib/payment-pending-status');
const {
    parseDonationCallback,
    parseUrlDonationCallback,
    verifyEcpayReturnCheckMac,
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

        const orderInfo = await getPaymentOrder(MerchantTradeNo);
        const isIchibanOrder =
            orderInfo &&
            orderInfo.kind !== 'ecpay-donation' &&
            orderInfo.eventId != null;

        if (isIchibanOrder) {
            const { eventId, cardIndex, clientId, merchantId, nickname } =
                orderInfo;

            const config = await getEcpayConfigByMerchantId(merchantId);
            if (!config || !verifyEcpayReturnCheckMac(req.body, config)) {
                res.status(400).send('0|ERROR');
                return;
            }

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
            await deletePaymentOrder(MerchantTradeNo);
        } else {
            if (process.env.NODE_ENV !== 'production') {
                console.log('[ecpay-success] 無一番賞訂單，當作斗內回調處理');
            }
            const body = req.body || {};
            const merchantId = MerchantID || body.MerchantID;
            const config = merchantId
                ? await getEcpayConfigByMerchantId(merchantId)
                : null;

            let row = null;
            let matchedConfig = config;
            if (body.Data) {
                if (config) {
                    row = parseDonationCallback(body, {
                        hashKey: config.hashKey,
                        hashIV: config.hashIV,
                    });
                    if (row) {
                        const payloadMerchantId = String(
                            row.merchantId || ''
                        ).trim();
                        const cfgMerchantId = String(
                            config.merchantId || merchantId || ''
                        ).trim();
                        if (
                            !payloadMerchantId ||
                            !cfgMerchantId ||
                            payloadMerchantId !== cfgMerchantId
                        ) {
                            console.warn(
                                '[ecpay-success] Data 解密後 MerchantID 不符',
                                { cfgMerchantId, payloadMerchantId }
                            );
                            row = null;
                        } else {
                            matchedConfig = config;
                        }
                    }
                }
                // 不再遍歷全站金鑰暴力解密，避免自註冊 key 偽造他店入帳
            } else if (config) {
                if (!verifyEcpayReturnCheckMac(req.body, config)) {
                    res.status(400).send('0|ERROR');
                    return;
                }
                row = parseUrlDonationCallback(body, config);
                matchedConfig = config;
            }

            if (row) {
                if (!row.merTradeNo && MerchantTradeNo) {
                    row.merTradeNo = MerchantTradeNo;
                }
                if (matchedConfig?.merchantId) {
                    row.merchantId = String(matchedConfig.merchantId).trim();
                }
                const isDonatePath =
                    (orderInfo && isDonationPendingKind(orderInfo.kind)) ||
                    !orderInfo;
                if (isDonatePath) {
                    try {
                        await processDonationFromPaymentCallback({
                            merchantTradeNo: MerchantTradeNo,
                            row,
                            logPrefix: 'ecpay-success',
                        });
                    } catch (donationErr) {
                        console.error(
                            '[ecpay-success] 斗內入帳失敗（仍回 1|OK）:',
                            donationErr
                        );
                    }
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
