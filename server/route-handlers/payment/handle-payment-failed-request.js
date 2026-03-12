const IchibanCardStore = require('../../store/ichiban-card');
const { ENUM_ICHIBAN_CARD_STATUS } = require('../../lib/enum');
const {
    getPaymentOrder,
    deletePaymentOrder,
} = require('../../store/payment-order');
const {
    getEcpayConfigByMerchantId,
} = require('../../store/ecpay-config');
const {
    verifyEcpayReturnCheckMac,
} = require('../../lib/payment-providers/ecpay');

module.exports = async (req, res) => {
    try {
        const body = req.body || {};
        const { MerchantTradeNo } = body;

        if (process.env.NODE_ENV !== 'production') {
            console.log('[ecpay-failed] 收到回調', {
                MerchantTradeNo,
                hasBody: !!req.body,
            });
        }

        const orderInfo = getPaymentOrder(MerchantTradeNo);

        if (!orderInfo) {
            res.status(200).send('1|OK');
            return;
        }

        const { eventId, cardIndex, clientId, merchantId } = orderInfo;

        const config = await getEcpayConfigByMerchantId(merchantId);
        if (!config || !verifyEcpayReturnCheckMac(body, config)) {
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
                status: ENUM_ICHIBAN_CARD_STATUS.CLOSED,
                openedAt: null,
                openedBy: null,
            });

            const { ichibanWebSocketServer } = global;
            if (ichibanWebSocketServer) {
                const timestamp = new Date().toISOString();
                ichibanWebSocketServer.broadcastToEvent(eventId, {
                    type: 'card-payment-failed',
                    eventId,
                    cardIndex,
                    clientId,
                    timestamp,
                });
                ichibanWebSocketServer.broadcastToRoom(
                    `merchant-${merchantId}`,
                    {
                        type: 'card-payment-failed-notification',
                        eventId,
                        cardIndex,
                        clientId,
                        timestamp,
                    }
                );
            }
        }

        deletePaymentOrder(MerchantTradeNo);
        res.status(200).send('1|OK');
    } catch (error) {
        console.error('[ecpay-failed] 處理錯誤:', error);
        res.status(500).send('0|ERROR');
    }
};
