const {
    completeDonationFromPayment,
} = require('./large-crowdfunding-donation');
const {
    getPaymentOrderForCallback,
    markPaymentOrderCompleted,
    revertPaymentOrderFromCompleted,
} = require('../store/payment-order');
const {
    PAYMENT_PENDING_STATUS,
    isDonationPendingKind,
} = require('../lib/payment-pending-status');
const {
    buildVideoTaskFromVideoIdAndCost,
} = require('../lib/youtube-donation');
const {
    verifyDonationOrderBinding,
} = require('../lib/payment-order-binding');

function applyPendingDonationMeta(row, pending) {
    if (!pending || !row) {
        return;
    }
    if (pending.fullMessage) {
        row.message = pending.fullMessage;
    }
    if (pending.fullName) {
        row.name = pending.fullName;
    }
}

/**
 * @param {object|null|undefined} result completeDonationFromPayment 回傳值
 * @returns {{ ok: boolean, duplicate: boolean, reason?: string }}
 */
function interpretDonationPaymentResult(result) {
    if (
        result &&
        typeof result === 'object' &&
        typeof result.status === 'string'
    ) {
        if (result.status === 'recorded') {
            return { ok: true, duplicate: false };
        }
        if (result.status === 'duplicate') {
            return { ok: true, duplicate: true };
        }
        if (result.status === 'rejected') {
            return {
                ok: false,
                duplicate: false,
                reason: result.reason || 'rejected',
            };
        }
        return {
            ok: false,
            duplicate: false,
            reason: `unknown-lcf-status:${result.status}`,
        };
    }
    if (result === null) {
        return { ok: true, duplicate: true };
    }
    return { ok: true, duplicate: false };
}

/**
 * 斗內付款成功回調：須有斗內預存（pending / expired）才入帳，避免無 meta 寫入一般 donations。
 * 以條件式 completed 更新搶鎖，避免併發重複入帳；入帳失敗則還原狀態供重試。
 *
 * verified 是呼叫端「驗簽成功之後」才知道的事實：哪間店的金鑰驗過、哪家金流。
 * 預存訂單必須屬於同一間店、同一家金流、同一個金額，否則一律不入帳。
 * 這是必填參數：漏傳視同驗證失敗，避免日後新增的回調忘了做檢查。
 *
 * @param {{ ecpayConfigId: number, provider: 'ecpay'|'payuni'|'opay' }} params.verified
 * @returns {Promise<{ recorded: boolean, skipped?: boolean, reason?: string }>}
 */
async function processDonationFromPaymentCallback({
    merchantTradeNo,
    row,
    query,
    logPrefix = 'donation-callback',
    youtubeConfig,
    verified,
}) {
    if (!row) {
        return { recorded: false, skipped: true, reason: 'no-row' };
    }

    const tradeNo =
        merchantTradeNo != null ? String(merchantTradeNo).trim() : '';
    const pending = tradeNo ? await getPaymentOrderForCallback(tradeNo) : null;

    if (pending?.status === PAYMENT_PENDING_STATUS.COMPLETED) {
        console.log(
            `[${logPrefix}] 預存訂單已入帳，略過重複回調:`,
            tradeNo
        );
        return { recorded: false, skipped: true, reason: 'already-completed' };
    }

    if (!pending || !isDonationPendingKind(pending.kind)) {
        console.warn(
            `[${logPrefix}] 無有效斗內預存，略過入帳（不寫入 donations）:`,
            tradeNo || '(無單號)'
        );
        return { recorded: false, skipped: true, reason: 'no-pending-donation' };
    }

    const binding = verifyDonationOrderBinding(pending, {
        ecpayConfigId: verified?.ecpayConfigId,
        provider: verified?.provider,
        amount: row.cost,
    });
    if (!binding.ok) {
        console.warn(`[${logPrefix}] 回調與預存訂單不相符，拒絕入帳:`, {
            tradeNo,
            reason: binding.reason,
            verifiedConfigId: verified?.ecpayConfigId ?? null,
            orderConfigId: pending.ecpayConfigId ?? null,
            provider: verified?.provider ?? null,
            kind: pending.kind ?? null,
            paidAmount: row.cost,
            orderAmount: pending.amount ?? null,
        });
        return { recorded: false, skipped: true, reason: binding.reason };
    }

    const previousStatus = pending.status;

    if (pending.status === PAYMENT_PENDING_STATUS.EXPIRED) {
        console.log(
            `[${logPrefix}] 逾時預存仍收到付款回調，依預存 meta 入帳:`,
            tradeNo
        );
    }

    applyPendingDonationMeta(row, pending);

    if (
        youtubeConfig &&
        pending.youtubeVideoPayload != null &&
        String(pending.youtubeVideoPayload).trim()
    ) {
        const ytPayload = String(pending.youtubeVideoPayload).trim();
        const videoTask = buildVideoTaskFromVideoIdAndCost(
            ytPayload,
            row.cost,
            null,
            youtubeConfig
        );
        if (videoTask) {
            row.videoTask = videoTask;
        }
    }

    const acquired = await markPaymentOrderCompleted(tradeNo);
    if (!acquired) {
        const again = await getPaymentOrderForCallback(tradeNo);
        if (again?.status === PAYMENT_PENDING_STATUS.COMPLETED) {
            console.log(
                `[${logPrefix}] 併發回調已由其他請求入帳，略過:`,
                tradeNo
            );
            return {
                recorded: false,
                skipped: true,
                reason: 'already-completed',
            };
        }
        console.warn(`[${logPrefix}] 無法取得入帳鎖:`, tradeNo);
        return { recorded: false, skipped: true, reason: 'claim-failed' };
    }

    try {
        const result = await completeDonationFromPayment(row, pending, query);
        const outcome = interpretDonationPaymentResult(result);

        if (!outcome.ok) {
            await revertPaymentOrderFromCompleted(tradeNo, previousStatus);
            console.warn(
                `[${logPrefix}] 斗內入帳被拒絕，已還原預存狀態:`,
                tradeNo,
                outcome.reason
            );
            return {
                recorded: false,
                skipped: true,
                reason: outcome.reason || 'rejected',
            };
        }

        if (outcome.duplicate) {
            console.log(
                `[${logPrefix}] 斗內已存在（冪等），略過重複寫入:`,
                tradeNo
            );
            return { recorded: false, skipped: true, reason: 'duplicate' };
        }

        return { recorded: true };
    } catch (donationErr) {
        await revertPaymentOrderFromCompleted(tradeNo, previousStatus);
        console.error(`[${logPrefix}] 斗內入帳失敗:`, donationErr);
        throw donationErr;
    }
}

module.exports = {
    applyPendingDonationMeta,
    interpretDonationPaymentResult,
    processDonationFromPaymentCallback,
};
