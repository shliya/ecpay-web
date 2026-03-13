const FundraisingEventsStore = require('../store/fundraising-events');
const { getEcpayConfigByMerchantId } = require('../store/ecpay-config');

async function getActiveFundraisingEventsByMerchantId(merchantId) {
    const ecpayConfigId =
        await FundraisingEventsStore.resolveEcpayConfigId(merchantId);
    if (ecpayConfigId == null) return [];
    return FundraisingEventsStore.getActiveFundraisingEventsByEcpayConfigId(
        ecpayConfigId
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

async function batchUpdateFundraisingEventByMerchantId(
    merchantId,
    { cost, type }
) {
    const ecpayConfigId =
        await FundraisingEventsStore.resolveEcpayConfigId(merchantId);
    if (ecpayConfigId == null) return [0];
    return FundraisingEventsStore.batchUpdateFundraisingEventByEcpayConfigId(
        ecpayConfigId,
        {
            cost,
            type,
        }
    );
}

module.exports = {
    createFundraisingEvent,
    getFundraisingEventByIdAndMerchantId,
    updateFundraisingEventByIdAndMerchantId,
    disableFundraisingEventByIdAndMerchantId:
        FundraisingEventsStore.disableFundraisingEventByIdAndMerchantId,
    enableFundraisingEventByIdAndMerchantId:
        FundraisingEventsStore.enableFundraisingEventByIdAndMerchantId,
    pauseFundraisingEventByIdAndMerchantId:
        FundraisingEventsStore.pauseFundraisingEventByIdAndMerchantId,
    batchUpdateFundraisingEventByMerchantId,
    getActiveFundraisingEventsByMerchantId,
};
