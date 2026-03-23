require('dotenv').config();
const DonationStore = require('../store/donation');
const {
    batchUpdateFundraisingEventByMerchantId,
} = require('./fundraising-events');
const {
    ENUM_FUNDRAISING_EVENT_TYPE,
    ENUM_DONATION_TYPE,
} = require('../lib/enum');

const SPECIAL_MESSAGE_CONDITION_MERCHANTS = (
    process.env.SPECIAL_MESSAGE_CONDITION_MERCHANTS || ''
)
    .split(',')
    .filter(Boolean);

async function createDonation(row, { transaction, skipDedupCheck } = {}) {
    if (!skipDedupCheck) {
        const isDuplicate = await DonationStore.isDuplicateDonation(
            row.merchantId,
            row.cost,
            row.name
        );
        if (isDuplicate) {
            return null;
        }
    }

    const txn = transaction || (await DonationStore.getTransaction());
    const shouldCommit = !transaction;

    try {
        await DonationStore.createDonation(row, {
            transaction: txn,
        });

        if (row.message === '') {
            await batchUpdateFundraisingEventByMerchantId(row.merchantId, {
                cost: row.cost,
                type: ENUM_FUNDRAISING_EVENT_TYPE.BLOOD_PRESSURE,
            });
        } else {
            await batchUpdateFundraisingEventByMerchantId(row.merchantId, {
                cost: row.cost,
            });
        }

        if (shouldCommit) {
            await txn.commit();
            const { ichibanWebSocketServer } = global;
            if (ichibanWebSocketServer && row.merchantId) {
                ichibanWebSocketServer.broadcastToMerchant(row.merchantId, {
                    type: 'new-donation',
                    name: row.name,
                    cost: row.cost,
                    message: row.message || '',
                    donationType:
                        row.type != null ? row.type : ENUM_DONATION_TYPE.ECPAY,
                    timestamp: new Date().toISOString(),
                });
            }
        }
    } catch (error) {
        if (shouldCommit) {
            await txn.rollback();
        }
        throw error;
    }
}

async function getDonationsByEcpayConfigId(ecpayConfigId) {
    const donations =
        await DonationStore.getDonationsByMerchantId(ecpayConfigId);
    const filteredDonations = donations.filter(donation => {
        const blockedKeywords = donation.ecpayConfig.blockedKeywords;
        return blockedKeywords.every(
            keyword =>
                !donation.message?.toLowerCase().includes(keyword.toLowerCase())
        );
    });
    return filteredDonations;
}

module.exports = {
    getDonationsByMerchantId: DonationStore.getDonationsByMerchantId,
    getDonationsByEcpayConfigId,
    createDonation,
};
