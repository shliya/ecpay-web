const IchibanEventStore = require('../store/ichiban-event');
const IchibanPrizeStore = require('../store/ichiban-prize');
const IchibanCardStore = require('../store/ichiban-card');
const {
    ENUM_ICHIBAN_EVENT_STATUS,
    ENUM_ICHIBAN_CARD_STATUS,
} = require('../lib/enum');

async function createIchibanEvent({
    merchantId,
    eventName,
    description,
    totalCards,
    startTime,
    endTime,
    prizes,
}) {
    const txn = await IchibanEventStore.getTransaction();

    try {
        const event = await IchibanEventStore.createIchibanEvent(
            {
                merchantId,
                eventName,
                description,
                totalCards,
                openedCards: 0,
                startTime: startTime || null,
                endTime: endTime || null,
                status: ENUM_ICHIBAN_EVENT_STATUS.ACTIVE,
            },
            { transaction: txn }
        );
        const newPrizes = prizes.map(prize => ({
            eventId: event.id,
            prizeName: prize.prizeName,
            quantity: prize.quantity,
        }));
        const createdPrizes = await IchibanPrizeStore.batchCreateIchibanPrizes(
            newPrizes,
            {
                transaction: txn,
            }
        );
        await _generateIchibanEventCards(event.id, totalCards, createdPrizes, {
            transaction: txn,
        });
        await txn.commit();
    } catch (error) {
        await txn.rollback();
        throw error;
    }
}

async function _generateIchibanEventCards(
    eventId,
    totalCards,
    newPrizes,
    { transaction } = {}
) {
    const prizePool = [];

    newPrizes.forEach(prize => {
        for (let i = 0; i < prize.quantity; i++) {
            prizePool.push(prize.id);
        }
    });

    for (let i = prizePool.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [prizePool[i], prizePool[j]] = [prizePool[j], prizePool[i]];
    }

    const cards = [];
    for (let i = 0; i < totalCards; i++) {
        cards.push({
            eventId,
            cardIndex: i,
            prizeId: prizePool[i],
            status: ENUM_ICHIBAN_CARD_STATUS.CLOSED,
        });
    }

    return IchibanCardStore.batchCreateIchibanCards(cards, { transaction });
}

module.exports = {
    createIchibanEvent,
    getIchibanEventsByMerchantId:
        IchibanEventStore.getIchibanEventsByMerchantId,
    getIchibanEventByIdAndMerchantId:
        IchibanEventStore.getIchibanEventByIdAndMerchantId,
    updateIchibanEventByIdAndMerchantId:
        IchibanEventStore.updateIchibanEventByIdAndMerchantId,
};
