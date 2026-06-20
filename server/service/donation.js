require('dotenv').config();
const DonationStore = require('../store/donation');
const LcfDonationStore = require('../store/large-crowdfunding-donation');
const { getEcpayConfigByMerchantId } = require('../store/ecpay-config');
const {
    batchUpdateFundraisingEventByMerchantId,
} = require('./fundraising-events');
const { ENUM_DONATION_TYPE } = require('../lib/enum');
const { broadcastNewDonation } = require('../lib/donation-notify');

const SPECIAL_MESSAGE_CONDITION_MERCHANTS = (
    process.env.SPECIAL_MESSAGE_CONDITION_MERCHANTS || ''
)
    .split(',')
    .filter(Boolean);

function passesBlockedKeywords(message, blockedKeywords) {
    if (!Array.isArray(blockedKeywords) || blockedKeywords.length === 0) {
        return true;
    }
    const msg = String(message || '').toLowerCase();
    return blockedKeywords.every(
        keyword => !msg.includes(String(keyword || '').toLowerCase())
    );
}

function mapLcfDonationForListRow(row, blockedKeywords) {
    const plain = typeof row.get === 'function' ? row.get({ plain: true }) : row;
    const message = plain.message || '';
    if (!passesBlockedKeywords(message, blockedKeywords)) {
        return null;
    }
    return {
        id: `lcf-${plain.id}`,
        name: plain.donorName,
        cost: Number(plain.amount) || 0,
        message,
        type: ENUM_DONATION_TYPE.LARGE_CROWDFUNDING,
        created_at: plain.created_at,
        pageKey: plain.pageKey,
    };
}

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
        const rowForDb = { ...row };
        delete rowForDb.videoTask;
        delete rowForDb.merTradeNo;

        await DonationStore.createDonation(rowForDb, {
            transaction: txn,
        });

        await batchUpdateFundraisingEventByMerchantId(row.merchantId, {
            cost: row.cost,
        });

        if (shouldCommit) {
            await txn.commit();
            await broadcastNewDonation({
                merchantId: row,
                name: row.name,
                cost: row.cost,
                message: row.message || '',
                donationType:
                    row.type != null
                        ? row.type
                        : ENUM_DONATION_TYPE.ECPAY,
                videoTask: row.videoTask,
            });
        }
    } catch (error) {
        if (shouldCommit) {
            await txn.rollback();
        }
        throw error;
    }
}

async function getDonationsByEcpayConfigId(merchantId) {
    const ecpayConfigId =
        await DonationStore.transferMerchantIdToEcpayConfigId(merchantId);
    if (ecpayConfigId == null) {
        throw new Error('Ecpay config not found');
    }

    const config = await getEcpayConfigByMerchantId(merchantId);
    const blockedKeywords = config?.blockedKeywords || [];

    const [donations, lcfRows] = await Promise.all([
        DonationStore.getDonationsByEcpayConfigId(ecpayConfigId),
        LcfDonationStore.listByEcpayConfigId(ecpayConfigId),
    ]);

    const filteredRegular = donations.filter(donation => {
        const keywords =
            donation.ecpayConfig?.blockedKeywords || blockedKeywords;
        return passesBlockedKeywords(donation.message, keywords);
    });

    const lcfForList = lcfRows
        .map(row => mapLcfDonationForListRow(row, blockedKeywords))
        .filter(Boolean);

    const regularForList = filteredRegular.map(donation => {
        const plain =
            typeof donation.get === 'function'
                ? donation.get({ plain: true })
                : donation;
        return plain;
    });

    return [...regularForList, ...lcfForList].sort(
        (a, b) => new Date(b.created_at) - new Date(a.created_at)
    );
}

async function getDonationsByStartDateEndDateAndEcpayConfigId(
    startDate,
    endDate,
    merchantId
) {
    const ecpayConfigId =
        await DonationStore.transferMerchantIdToEcpayConfigId(merchantId);
    if (ecpayConfigId == null) {
        throw new Error('Ecpay config not found');
    }
    return DonationStore.getDonationsByEcpayConfigIdAndDate(ecpayConfigId, {
        startDate,
        endDate,
    });
}

module.exports = {
    getDonationsByMerchantId: DonationStore.getDonationsByMerchantId,
    getDonationsByEcpayConfigId,
    createDonation,
    getDonationsByStartDateEndDateAndEcpayConfigId,
};
