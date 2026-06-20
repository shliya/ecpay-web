const {
    getPayuniConfigByPayuniMerchantId,
} = require('../../service/ecpay-config');
const { parseDonationCallback } = require('../../lib/payment-providers/payuni');
const {
    processDonationFromPaymentCallback,
} = require('../../service/donation-payment-callback');
const {
    getYoutubePricePerSecFromConfig,
    getYoutubeMaxPlaySecFromConfig,
} = require('../../lib/youtube-donation');
const IchibanCardStore = require('../../store/ichiban-card');
const IchibanEventStore = require('../../store/ichiban-event');
const IchibanEventService = require('../../service/ichiban-event');
const {
    ENUM_ICHIBAN_CARD_STATUS,
    ENUM_ICHIBAN_EVENT_STATUS,
} = require('../../lib/enum');
const {
    getPaymentOrder,
    deletePaymentOrder,
} = require('../../store/payment-order');

module.exports = async (req, res) => {
    try {
        const { merchantId } = req.params;

        const config = await getPayuniConfigByPayuniMerchantId(merchantId, {
            properties: [
                'id',
                'payuniMerchantId',
                'payuniHashKey',
                'payuniHashIV',
                'youtubeDonationAmount',
                'youtubeDonationMaxPlaySec',
            ],
        });

        if (!config) {
            throw new Error(`無法讀取商店 ${merchantId} 的設定`);
        }

        const row = parseDonationCallback(req.body, req.query, {
            hashKey: config.payuniHashKey,
            hashIV: config.payuniHashIV,
            ecpayConfigId: config.id,
            youtubeDonationAmount: config.youtubeDonationAmount,
            youtubeDonationMaxPlaySec: config.youtubeDonationMaxPlaySec,
        });

        if (!row) {
            res.status(200).send('OK');
            return;
        }

        const merTradeNo = row.merTradeNo;
        const orderInfo = merTradeNo ? await getPaymentOrder(merTradeNo) : null;

        if (
            orderInfo &&
            orderInfo.eventId != null &&
            orderInfo.cardIndex != null
        ) {
            const {
                eventId,
                cardIndex,
                clientId,
                merchantId: orderMerchantId,
                nickname,
            } = orderInfo;
            const { ichibanWebSocketServer } = global;

            const card =
                await IchibanCardStore.getIchibanCardByEventIdAndCardIndexAndStatus(
                    eventId,
                    cardIndex,
                    ENUM_ICHIBAN_CARD_STATUS.LOCKED
                );

            if (card && ichibanWebSocketServer) {
                await IchibanCardStore.updateIchibanCardByIdAndStatus(card.id, {
                    status: ENUM_ICHIBAN_CARD_STATUS.OPENED,
                    openedAt: new Date(),
                    openedBy: nickname || row.name,
                });

                await IchibanEventService.incrementOpenedCards(eventId);

                const prizeName = card.prize?.prizeName || '未知獎品';

                ichibanWebSocketServer.broadcastToEvent(eventId, {
                    type: 'card-opened',
                    eventId,
                    cardIndex,
                    prizeName,
                    openedBy: nickname || row.name,
                    openedByClientId: clientId,
                    timestamp: new Date().toISOString(),
                });

                ichibanWebSocketServer.broadcastToRoom(
                    `merchant-${orderMerchantId}`,
                    {
                        type: 'card-opened-notification',
                        eventId,
                        cardIndex,
                        prizeName,
                        openedBy: nickname || row.name,
                        openedByClientId: clientId,
                        timestamp: new Date().toISOString(),
                    }
                );

                const event =
                    await IchibanEventStore.getIchibanEventByIdAndMerchantId(
                        eventId,
                        orderMerchantId
                    );
                if (event && event.status === ENUM_ICHIBAN_EVENT_STATUS.ENDED) {
                    ichibanWebSocketServer.broadcastToEvent(eventId, {
                        type: 'event-ended',
                        eventId,
                        message: '活動已結束 - 所有卡片都已開啟',
                        timestamp: new Date().toISOString(),
                    });
                    ichibanWebSocketServer.broadcastToRoom(
                        `merchant-${orderMerchantId}`,
                        {
                            type: 'event-ended-notification',
                            eventId,
                            message: '活動已結束 - 所有卡片都已開啟',
                            timestamp: new Date().toISOString(),
                        }
                    );
                }
            }

            await deletePaymentOrder(merTradeNo);
        } else {
            try {
                await processDonationFromPaymentCallback({
                    merchantTradeNo: merTradeNo,
                    row,
                    query: req.query,
                    logPrefix: 'payuni-notify',
                    youtubeConfig: {
                        pricePerSec: getYoutubePricePerSecFromConfig(config),
                        maxPlaySec: getYoutubeMaxPlaySecFromConfig(config),
                    },
                });
            } catch (donationErr) {
                console.error(
                    '[payuni-notify] 斗內入帳失敗（仍回 OK）:',
                    donationErr
                );
            }
        }

        res.status(200).send('OK');
    } catch (error) {
        console.error('PAYUNi Webhook Error:', error);
        if (error && error.statusCode === 400) {
            res.status(400).send('Error');
            return;
        }
        res.status(200).send('OK');
    }
};
