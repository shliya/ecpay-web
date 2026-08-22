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

    const filteredRegular = donations.filter(donation =>
        passesBlockedKeywords(donation.message, blockedKeywords)
    );

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

    return [...regularForList, ...lcfForList]
        .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
        .slice(0, DonationStore.DONATION_LIST_LIMIT);
}

/**
 * 公開列表用的欄位投影：僅保留展示所需，移除 id／merchantId／ecpayConfigId 等內部欄位
 * @param {object} row
 * @returns {{ name: string, cost: number, message: string, type: number, created_at: * }}
 */
function toPublicDonationRow(row) {
    return {
        name: row.name || '',
        cost: Number(row.cost) || 0,
        message: row.message || '',
        type: Number(row.type) || ENUM_DONATION_TYPE.ECPAY,
        created_at: row.created_at,
    };
}

/**
 * 取得公開斗內列表（不需 TOTP）。商店不存在時回空陣列。
 * @param {string} merchantId
 * @returns {Promise<Array<ReturnType<typeof toPublicDonationRow>>>}
 */
async function getPublicDonationsByMerchantId(merchantId) {
    const donations = await getDonationsByEcpayConfigId(merchantId);
    return donations.map(toPublicDonationRow);
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
    getPublicDonationsByMerchantId,
    createDonation,
    getDonationsByStartDateEndDateAndEcpayConfigId,
};
