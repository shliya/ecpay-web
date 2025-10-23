const IchibanCardStore = require('../store/ichiban-card');
const Sequelize = require('sequelize');

async function getIchibanCardByEventIdAndCardIndexAndStatusWithLock(
    eventId,
    cardIndex,
    status
) {
    const txn = await IchibanCardStore.getTransaction();

    try {
        const card =
            await IchibanCardStore.getIchibanCardByEventIdAndCardIndexAndStatusWithoutInclude(
                eventId,
                cardIndex,
                status,
                { transaction: txn, lock: txn.LOCK.UPDATE }
            );

        if (!card) {
            await txn.commit();
            return null;
        }

        const cardWithPrize =
            await IchibanCardStore.getIchibanCardByEventIdAndCardIndexAndStatus(
                eventId,
                cardIndex,
                status,
                { transaction: txn, lock: false }
            );

        await txn.commit();
        return cardWithPrize;
    } catch (error) {
        await txn.rollback();
        throw error;
    }
}

async function updateIchibanCardByIdAndStatus(id, updateData) {
    const txn = await IchibanCardStore.getTransaction();

    try {
        const result = await IchibanCardStore.updateIchibanCardByIdAndStatus(
            id,
            updateData,
            { transaction: txn }
        );
        await txn.commit();
        return result;
    } catch (error) {
        await txn.rollback();
        throw error;
    }
}

module.exports = {
    getIchibanCardByEventIdAndCardIndexAndStatusWithLock,
    updateIchibanCardByIdAndStatus,
};
