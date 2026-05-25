const PageStore = require('../store/large-crowdfunding-page');
const DonationStore = require('../store/large-crowdfunding-donation');
const PageService = require('./large-crowdfunding-page');
const { createDonation: createEcpayDonation } = require('./donation');
const {
    assertPageAcceptsDonationsAtOrderTime,
    assertPageAcceptsPaymentCallback,
    parseLargeCrowdfundingPageId,
} = require('../lib/large-crowdfunding');

/**
 * @param {object} result
 * @param {object} context
 */
function logLcfDonationResult(result, context) {
    if (!result || result.status === 'recorded' || result.status === 'duplicate') {
        return;
    }
    console.error('[large-crowdfunding-donation]', result.status, {
        reason: result.reason,
        ...context,
    });
}

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
 * @returns {Promise<{ status: string, reason?: string, pageKey?: string, amount?: number, name?: string }>}
 */
async function recordDonationFromPayment({
    largeCrowdfundingPageId,
    merchantId,
    donorName,
    amount,
    message,
    sourceDonationId,
    paymentTradeNo,
    trustOrderContext,
}) {
    const pageId = parseLargeCrowdfundingPageId(largeCrowdfundingPageId);
    if (pageId == null) {
        return { status: 'rejected', reason: 'largeCrowdfundingPageId 無效' };
    }

    const page = await PageService.getPageForDonationValidation(
        pageId,
        merchantId
    );

    const gate = trustOrderContext
        ? assertPageAcceptsPaymentCallback(page, merchantId)
        : assertPageAcceptsDonationsAtOrderTime(page);
    if (!gate.ok) {
        return { status: 'rejected', reason: gate.reason || '無法接受斗內' };
    }

    const amountNum = Number(amount);
    if (!Number.isInteger(amountNum) || amountNum <= 0) {
        return { status: 'rejected', reason: 'amount 須為正整數' };
    }

    const name = String(donorName || '').trim() || '匿名';
    const tradeNo = paymentTradeNo ? String(paymentTradeNo).trim() : '';

    if (tradeNo) {
        const existing = await DonationStore.findByPaymentTradeNo(tradeNo);
        if (existing) {
            return { status: 'duplicate' };
        }
    }

    const txn = await PageStore.getTransaction();
    try {
        const created = await DonationStore.createDonation(
            {
                largeCrowdfundingPageId: pageId,
                merchantId: page.merchantId,
                pageKey: page.pageKey,
                donorName: name,
                amount: amountNum,
                message: message ? String(message).trim() : null,
                sourceDonationId: sourceDonationId || null,
                paymentTradeNo: tradeNo || null,
            },
            { transaction: txn }
        );
        if (created.duplicate) {
            await txn.rollback();
            return { status: 'duplicate' };
        }
        await PageStore.incrementCurrentTotal(pageId, amountNum, {
            transaction: txn,
        });
        await txn.commit();
        return {
            status: 'recorded',
            pageKey: page.pageKey,
            amount: amountNum,
            name,
        };
    } catch (err) {
        await txn.rollback();
        throw err;
    }
}

/**
 * 依付款來源完成斗內：大型募資 → 專表；一般 → donations
 * @param {object} row 綠界/PAYUNi 解析後的斗內列
 * @param {object} [orderInfo] payment_pending_orders.meta（建單時寫入 DB）
 * @param {object} [query] PAYUNi NotifyURL query（僅無 order 時當後備）
 */
async function completeDonationFromPayment(row, orderInfo, query) {
    const trustedPageId = parseLargeCrowdfundingPageId(
        orderInfo?.largeCrowdfundingPageId
    );
    const fallbackPageId =
        trustedPageId == null
            ? parseLargeCrowdfundingPageId(query?.lcfPageId)
            : null;
    const pageId = trustedPageId ?? fallbackPageId;
    const trustOrderContext = trustedPageId != null;

    if (pageId != null) {
        const paymentTradeNo =
            row.merTradeNo != null ? String(row.merTradeNo).trim() : '';
        const result = await recordDonationFromPayment({
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
            paymentTradeNo: paymentTradeNo || undefined,
            trustOrderContext,
        });
        logLcfDonationResult(result, {
            pageId,
            trustOrderContext,
            paymentTradeNo: paymentTradeNo || null,
            merchantId: row.merchantId,
        });
        return result;
    }

    return createEcpayDonation(row);
}

module.exports = {
    listRecentDonorsForApi,
    recordDonationFromPayment,
    completeDonationFromPayment,
    logLcfDonationResult,
};
