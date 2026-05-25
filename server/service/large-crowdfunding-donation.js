const PageStore = require('../store/large-crowdfunding-page');
const DonationStore = require('../store/large-crowdfunding-donation');
const PageService = require('./large-crowdfunding-page');
const { createDonation: createEcpayDonation } = require('./donation');
const {
    assertPageAcceptsDonations,
    parseLargeCrowdfundingPageId,
} = require('../lib/large-crowdfunding');

/**
 * 近期榜單（公開 API）
 * @param {string} pageKey
 * @returns {Promise<Array<{ name: string, amount: number }>>}
 */
async function listRecentDonorsForApi(pageKey) {
    const rows = await DonationStore.listRecentByPageKey(pageKey);
    return rows.map(r => {
        const plain = typeof r.get === 'function' ? r.get({ plain: true }) : r;
        return {
            name: plain.donorName,
            amount: Number(plain.amount) || 0,
        };
    });
}

/**
 * 付款成功後寫入大型募資斗內表（不寫入 donations、不更新月曆募資）
 * @param {object} params
 * @param {number} params.largeCrowdfundingPageId
 * @param {string} params.merchantId
 * @param {string} params.donorName
 * @param {number} params.amount
 * @param {string} [params.message]
 * @param {number} [params.sourceDonationId]
 */
async function recordDonationFromPayment({
    largeCrowdfundingPageId,
    merchantId,
    donorName,
    amount,
    message,
    sourceDonationId,
}) {
    const pageId = parseLargeCrowdfundingPageId(largeCrowdfundingPageId);
    if (pageId == null) {
        throw new Error('largeCrowdfundingPageId 無效');
    }

    const page = await PageService.getPageForDonationValidation(
        pageId,
        merchantId
    );
    const gate = assertPageAcceptsDonations(page);
    if (!gate.ok) {
        throw new Error(gate.reason || '無法接受斗內');
    }

    const amountNum = Number(amount);
    if (!Number.isInteger(amountNum) || amountNum <= 0) {
        throw new Error('amount 須為正整數');
    }

    const name = String(donorName || '').trim() || '匿名';
    const isDup = await DonationStore.isDuplicateWithinWindow(
        pageId,
        name,
        amountNum
    );
    if (isDup) {
        return null;
    }

    const txn = await PageStore.getTransaction();
    try {
        await DonationStore.createDonation(
            {
                largeCrowdfundingPageId: pageId,
                merchantId: page.merchantId,
                pageKey: page.pageKey,
                donorName: name,
                amount: amountNum,
                message: message ? String(message).trim() : null,
                sourceDonationId: sourceDonationId || null,
            },
            { transaction: txn }
        );
        await PageStore.incrementCurrentTotal(pageId, amountNum, {
            transaction: txn,
        });
        await txn.commit();
        return { pageKey: page.pageKey, amount: amountNum, name };
    } catch (err) {
        await txn.rollback();
        throw err;
    }
}

/**
 * 依付款來源完成斗內：大型募資 → 專表；一般 → donations
 * @param {object} row 綠界/PAYUNi 解析後的斗內列
 * @param {object} [orderInfo] payment-order 暫存
 * @param {object} [query] PAYUNi NotifyURL query（lcfPageId）
 */
async function completeDonationFromPayment(row, orderInfo, query) {
    const pageId =
        parseLargeCrowdfundingPageId(orderInfo?.largeCrowdfundingPageId) ??
        parseLargeCrowdfundingPageId(query?.lcfPageId);

    if (pageId != null) {
        return recordDonationFromPayment({
            largeCrowdfundingPageId: pageId,
            merchantId: row.merchantId,
            donorName:
                orderInfo?.fullName != null && orderInfo.fullName !== ''
                    ? orderInfo.fullName
                    : row.name,
            amount: row.cost,
            message:
                orderInfo?.fullMessage != null
                    ? orderInfo.fullMessage
                    : row.message,
        });
    }

    return createEcpayDonation(row);
}

module.exports = {
    listRecentDonorsForApi,
    recordDonationFromPayment,
    completeDonationFromPayment,
};
