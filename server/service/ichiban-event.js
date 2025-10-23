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
    cost,
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
                cost,
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

async function incrementOpenedCards(eventId) {
    const txn = await IchibanEventStore.getTransaction();

    try {
        // 先獲取活動資訊
        const event = await IchibanEventStore.getIchibanEventById(eventId, {
            transaction: txn,
        });
        if (!event) {
            throw new Error('Event not found');
        }

        // 更新開啟卡片數量
        await IchibanEventStore.updateIchibanEventOpenedCards(eventId, {
            transaction: txn,
        });

        // 檢查是否所有卡片都已開啟
        const updatedEvent = await IchibanEventStore.getIchibanEventById(
            eventId,
            {
                transaction: txn,
            }
        );
        if (
            updatedEvent.openedCards >= updatedEvent.totalCards &&
            updatedEvent.status === ENUM_ICHIBAN_EVENT_STATUS.ACTIVE
        ) {
            // 將活動狀態設為已結束
            await IchibanEventStore.updateIchibanEventStatus(
                eventId,
                ENUM_ICHIBAN_EVENT_STATUS.ENDED,
                { transaction: txn }
            );

            console.log(
                `活動 ${eventId} 已自動結束 - 所有卡片都已開啟 (${updatedEvent.openedCards}/${updatedEvent.totalCards})`
            );
        }

        await txn.commit();
        return true;
    } catch (error) {
        await txn.rollback();
        console.error('Error incrementing opened cards:', error);
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
    incrementOpenedCards,
    getIchibanEventsByMerchantId:
        IchibanEventStore.getIchibanEventsByMerchantId,
    getIchibanEventByIdAndMerchantId:
        IchibanEventStore.getIchibanEventByIdAndMerchantId,
    updateIchibanEventByIdAndMerchantId:
        IchibanEventStore.updateIchibanEventByIdAndMerchantId,
};
