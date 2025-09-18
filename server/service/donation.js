require('dotenv').config();
const DonationStore = require('../store/donation');
const FundraisingEventsStore = require('../store/fundraising-events');
const { ENUM_FUNDRAISING_EVENT_TYPE } = require('../lib/enum');

const SPECIAL_MESSAGE_CONDITION_MERCHANTS =
    process.env.SPECIAL_MESSAGE_CONDITION_MERCHANTS.split(',');

async function createDonation(row, { transaction } = {}) {
    const txn = await DonationStore.getTransaction();

    try {
        await DonationStore.createDonation(row, {
            transaction: txn,
        });

        if (
            row.message === '' &&
            SPECIAL_MESSAGE_CONDITION_MERCHANTS.includes(row.merchantId)
        ) {
            await FundraisingEventsStore.batchUpdateFundraisingEventByMerchantId(
                row.merchantId,
                {
                    cost: row.cost,
                    type: ENUM_FUNDRAISING_EVENT_TYPE.BLOOD_PRESSURE,
                }
            );
        } else {
            await FundraisingEventsStore.batchUpdateFundraisingEventByMerchantId(
                row.merchantId,
                { cost: row.cost }
            );
        }

        await txn.commit();
    } catch (error) {
        await txn.rollback();
        throw error;
    }
}

module.exports = {
    getDonationsByMerchantId: DonationStore.getDonationsByMerchantId,
    createDonation,
};
