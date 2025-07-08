const FundraisingEventsStore = require('../store/fundraising-events');
const DonationStore = require('../store/donation');

async function getFundraisingEventsByMerchantId(merchantId) {
    const event =
        await FundraisingEventsStore.getFundraisingEventsByMerchantId(
            merchantId
        );

    const donations = await DonationStore.getDonationsByMerchantIdAndDate(
        merchantId,
        { startDate: event.startMonth, endDate: event.endMonth }
    );

    const totalCost = donations.reduce(
        (acc, donation) => acc + donation.cost,
        0
    );

    event.dataValues.cost = totalCost;

    return event;
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

module.exports = {
    getFundraisingEventsByMerchantId,
    createFundraisingEvent,
};
