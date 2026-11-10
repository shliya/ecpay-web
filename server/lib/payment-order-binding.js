/**
 * 金流回調 ↔ 預存訂單的綁定檢查。
 *
 * 金流回調要回答兩個問題：
 *   1. 這筆回調是真的嗎？    → 用「某間店」的金鑰驗簽
 *   2. 這筆錢要記到哪裡？    → 用單號找到 pending order
 *
 * 兩邊的「店」來源不同：驗簽的店由回調網址／body 決定，訂單的店由單號決定，
 * 而兩者都是送回調的人可以控制的。任何人都能自建商店並填自己的金鑰，
 * 所以「驗簽通過」只代表「這是某間店簽的」，不代表「這是訂單那間店收到的款」。
 *
 * 這裡把兩者綁死：驗簽的店必須就是建單的店、金流必須相同、金額必須相同。
 * 一律 fail closed —— 缺任何一項資料都拒絕，不做相容放行。
 */

const PROVIDERS = new Set(['ecpay', 'payuni', 'opay']);

const BINDING_REASON = {
    NO_PENDING: 'binding-no-pending',
    NO_VERIFIED_CONTEXT: 'binding-no-verified-context',
    INVALID_PROVIDER: 'binding-invalid-provider',
    PROVIDER_MISMATCH: 'binding-provider-mismatch',
    ORDER_MISSING_CONFIG: 'binding-order-missing-config',
    CONFIG_MISMATCH: 'binding-config-mismatch',
    ORDER_MISSING_AMOUNT: 'binding-order-missing-amount',
    AMOUNT_MISMATCH: 'binding-amount-mismatch',
};

const PASS = { ok: true };

function fail(reason) {
    return { ok: false, reason };
}

/** 只接受正整數；字串 '2' 與數字 2 視為相同，其餘（空值、0、負數、小數）一律回 null */
function toPositiveInt(value) {
    if (value == null || value === '') {
        return null;
    }
    const n = Number(value);
    return Number.isSafeInteger(n) && n > 0 ? n : null;
}

// ---- 斗內訂單的三項檢查 ---------------------------------------------------
// 每支只回答一個問題：通過回 null，不通過回失敗原因。

/**
 * 檢查 1：是同一家金流嗎？
 * 建單端把 kind 寫死成 `${provider}-donation`，所以綠界的回調不能結 PayUni 的單。
 */
function checkSameProvider(pending, verified) {
    const provider = String(verified.provider || '');
    if (!PROVIDERS.has(provider)) {
        return BINDING_REASON.INVALID_PROVIDER;
    }
    if (String(pending.kind || '') !== `${provider}-donation`) {
        return BINDING_REASON.PROVIDER_MISMATCH;
    }
    return null;
}

/**
 * 檢查 2：驗簽的店，就是建單的店嗎？
 * 這是擋住跨店偽造的關鍵。舊版訂單沒有記錄 ecpayConfigId，無法證明歸屬，同樣不放行。
 */
function checkSameStore(pending, verified) {
    const verifiedConfigId = toPositiveInt(verified.ecpayConfigId);
    if (verifiedConfigId == null) {
        return BINDING_REASON.NO_VERIFIED_CONTEXT;
    }

    const orderConfigId = toPositiveInt(pending.ecpayConfigId);
    if (orderConfigId == null) {
        return BINDING_REASON.ORDER_MISSING_CONFIG;
    }

    if (orderConfigId !== verifiedConfigId) {
        return BINDING_REASON.CONFIG_MISMATCH;
    }
    return null;
}

/**
 * 檢查 3：付的錢，等於建單的金額嗎？
 * 回調的金額不可信，必須與建單時記錄的金額完全相同，多付少付都不行。
 */
function checkSameAmount(pending, verified) {
    const orderAmount = toPositiveInt(pending.amount);
    if (orderAmount == null) {
        return BINDING_REASON.ORDER_MISSING_AMOUNT;
    }

    const paidAmount = Number(verified.amount);
    if (paidAmount !== orderAmount) {
        return BINDING_REASON.AMOUNT_MISMATCH;
    }
    return null;
}

/**
 * 斗內訂單的綁定檢查：依序做三項檢查，任何一項不通過就拒絕。
 *
 * @param {object|null} pending payment_pending_orders 的 meta（含 kind）
 * @param {{ ecpayConfigId: number|string, provider: 'ecpay'|'payuni'|'opay', amount: number|string }} verified
 *        由「驗簽成功的那間店」與「回調內容」得出的事實
 * @returns {{ ok: true } | { ok: false, reason: string }}
 */
function verifyDonationOrderBinding(pending, verified) {
    if (!pending || typeof pending !== 'object') {
        return fail(BINDING_REASON.NO_PENDING);
    }
    if (!verified || typeof verified !== 'object') {
        return fail(BINDING_REASON.NO_VERIFIED_CONTEXT);
    }

    const reason =
        checkSameProvider(pending, verified) ||
        checkSameStore(pending, verified) ||
        checkSameAmount(pending, verified);

    return reason ? fail(reason) : PASS;
}

/**
 * 一番賞訂單的綁定檢查：建單時記錄的 merchantId 必須是驗簽那間店。
 * （一番賞訂單由 WebSocket 建立，目前沒有寫入 ecpayConfigId / amount，
 *   先以既有的 merchantId 綁定；金額比對待一番賞流程調整時一併補上。）
 *
 * @param {object|null} orderInfo
 * @param {{ merchantId: string }} verified
 * @returns {{ ok: true } | { ok: false, reason: string }}
 */
function verifyIchibanOrderBinding(orderInfo, verified) {
    if (!orderInfo || typeof orderInfo !== 'object') {
        return fail(BINDING_REASON.NO_PENDING);
    }

    const verifiedMerchantId = String(verified?.merchantId || '').trim();
    if (!verifiedMerchantId) {
        return fail(BINDING_REASON.NO_VERIFIED_CONTEXT);
    }

    const orderMerchantId = String(orderInfo.merchantId || '').trim();
    if (!orderMerchantId) {
        return fail(BINDING_REASON.ORDER_MISSING_CONFIG);
    }

    if (orderMerchantId !== verifiedMerchantId) {
        return fail(BINDING_REASON.CONFIG_MISMATCH);
    }
    return PASS;
}

module.exports = {
    BINDING_REASON,
    verifyDonationOrderBinding,
    verifyIchibanOrderBinding,
};
