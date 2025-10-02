const FundraisingEventsStore = require('../store/fundraising-events');
const DonationStore = require('../store/donation');

async function getFundraisingEventsByMerchantId(merchantId) {
    const events =
        await FundraisingEventsStore.getActiveFundraisingEventsByMerchantId(
            merchantId
        );

    // const donations = await DonationStore.getDonationsByMerchantIdAndDate(
    //     merchantId,
    //     { startDate: event.startMonth, endDate: event.endMonth }
    // );

    // const totalCost = donations.reduce(
    //     (acc, donation) => acc + donation.cost,
    //     0
    // );

    // event.dataValues.cost = totalCost;

    return events;
}

async function createFundraisingEvent(row, { transaction } = {}) {
    const txn = await FundraisingEventsStore.getTransaction();

    try {
        await FundraisingEventsStore.createFundraisingEvent(row, {
            transaction: txn,
        });
        await txn.commit();
    } catch (error) {
        await txn.rollback();
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
    try {
        const event =
            await FundraisingEventsStore.updateFundraisingEventByIdAndMerchantId(
                id,
                merchantId,
                { cost, eventName }
            );
        return event;
    } catch (error) {
        throw error;
    }
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
};
