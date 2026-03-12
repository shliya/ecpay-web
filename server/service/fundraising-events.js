const FundraisingEventsStore = require('../store/fundraising-events');

async function getFundraisingEventsByMerchantId(merchantId) {
    return FundraisingEventsStore.getActiveFundraisingEventsByMerchantId(
        merchantId
    );
}

async function createFundraisingEvent(row, { transaction } = {}) {
    const txn = transaction || (await FundraisingEventsStore.getTransaction());
    const shouldCommit = !transaction;

    try {
        await FundraisingEventsStore.createFundraisingEvent(row, {
            transaction: txn,
        });
        if (shouldCommit) {
            await txn.commit();
        }
    } catch (error) {
        if (shouldCommit) {
            await txn.rollback();
        }
        throw error;
    }
}

async function getFundraisingEventByIdAndMerchantId(id, merchantId) {
    const event =
        await FundraisingEventsStore.getFundraisingEventByIdAndMerchantId(
            id,
            merchantId
        );
    return event;
}

async function updateFundraisingEventByIdAndMerchantId(
    id,
    merchantId,
    { cost, eventName }
) {
    return FundraisingEventsStore.updateFundraisingEventByIdAndMerchantId(
        id,
        merchantId,
        { cost, eventName }
    );
}

module.exports = {
    getFundraisingEventsByMerchantId,
    createFundraisingEvent,
    getFundraisingEventByIdAndMerchantId,
    updateFundraisingEventByIdAndMerchantId,
    disableFundraisingEventByIdAndMerchantId:
        FundraisingEventsStore.disableFundraisingEventByIdAndMerchantId,
    enableFundraisingEventByIdAndMerchantId:
        FundraisingEventsStore.enableFundraisingEventByIdAndMerchantId,
    pauseFundraisingEventByIdAndMerchantId:
        FundraisingEventsStore.pauseFundraisingEventByIdAndMerchantId,
};
