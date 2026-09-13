const MerchantMember = require('../model/schema/merchant-member');
const MerchantBindAudit = require('../model/schema/merchant-bind-audit');
const { getEcpayConfigByMerchantId } = require('./ecpay-config');

/** 綁定失敗的原因碼，前端據此顯示對應訊息 */
const BIND_ERROR = {
    MERCHANT_NOT_FOUND: 'merchant_not_found',
    ALREADY_BOUND_BY_OTHER: 'already_bound_by_other',
    USER_HAS_OTHER_MERCHANT: 'user_has_other_merchant',
};

/**
 * 取得某個 Google 帳號綁定的所有商店（含商店顯示資訊）。
 * @param {string} userId
 */
async function getMembershipsByUserId(userId) {
    if (!userId) {
        return [];
    }

    const rows = await MerchantMember.findAll({
        where: { userId, status: 'active' },
        order: [['created_at', 'ASC']],
        raw: true,
    });

    const merchants = [];
    for (const row of rows) {
        const config = await getEcpayConfigByMerchantId(row.merchantId);
        merchants.push({
            merchantId: row.merchantId,
            role: row.role,
            boundVia: row.boundVia,
            boundAt: row.created_at,
            displayName: config ? config.displayName : null,
            exists: Boolean(config),
        });
    }
    return merchants;
}

/**
 * 此 user 是否為該商店的有效成員。授權檢查的核心，
 * 中介層每次請求都會呼叫。
 * @param {string} userId
 * @param {string} merchantId
 */
async function isMember(userId, merchantId) {
    if (!userId || !merchantId) {
        return false;
    }
    const row = await MerchantMember.findOne({
        where: {
            userId,
            merchantId: String(merchantId).trim(),
            status: 'active',
        },
        raw: true,
    });
    return Boolean(row);
}

/**
 * 取得綁定該商店的成員（沒有則回 null）。
 * 用來判斷這間店是否已經遷移到 Google 登入。
 * @param {string} merchantId
 */
async function getActiveMemberByMerchantId(merchantId) {
    if (!merchantId) {
        return null;
    }
    return MerchantMember.findOne({
        where: { merchantId: String(merchantId).trim(), status: 'active' },
        raw: true,
    });
}

/**
 * 建立綁定。呼叫前必須已經驗證過「商店所有權」（TOTP 或 hashKey），
 * 本函式只負責一致性檢查與寫入，不做身分驗證。
 *
 * @param {{ userId: string, merchantId: string, boundVia: string }} params
 * @returns {Promise<{ ok: true, created: boolean } | { ok: false, code: string }>}
 */
async function bindMerchant({ userId, merchantId, boundVia }) {
    const trimmedMerchantId = String(merchantId || '').trim();

    const config = await getEcpayConfigByMerchantId(trimmedMerchantId);
    if (!config) {
        return { ok: false, code: BIND_ERROR.MERCHANT_NOT_FOUND };
    }

    // 已經綁過同一間，視為成功（重複點擊、重新整理都會走到這裡）
    const existing = await MerchantMember.findOne({
        where: { userId, merchantId: trimmedMerchantId },
        raw: true,
    });
    if (existing) {
        return { ok: true, created: false };
    }

    // 這間店已經被別的 Google 帳號綁走
    const boundByOther = await MerchantMember.findOne({
        where: { merchantId: trimmedMerchantId, status: 'active' },
        raw: true,
    });
    if (boundByOther) {
        return { ok: false, code: BIND_ERROR.ALREADY_BOUND_BY_OTHER };
    }

    // 應用層的單店限制（方案 A3）：schema 支援多店，現階段先擋住。
    // 未來要開放多店，移除這一段即可，資料庫不需異動。
    const otherMerchant = await MerchantMember.findOne({
        where: { userId, status: 'active' },
        raw: true,
    });
    if (otherMerchant) {
        return { ok: false, code: BIND_ERROR.USER_HAS_OTHER_MERCHANT };
    }

    await MerchantMember.create({
        userId,
        merchantId: trimmedMerchantId,
        role: 'owner',
        status: 'active',
        boundVia: boundVia || null,
        created_at: new Date(),
        updated_at: new Date(),
    });

    return { ok: true, created: true };
}

/**
 * 列出所有綁定關係（管理用）。資料量等同商店數，不分頁。
 */
async function listAllMemberships() {
    const rows = await MerchantMember.findAll({
        order: [['created_at', 'DESC']],
        raw: true,
    });

    const result = [];
    for (const row of rows) {
        const config = await getEcpayConfigByMerchantId(row.merchantId);
        result.push({
            merchantId: row.merchantId,
            userId: row.userId,
            role: row.role,
            status: row.status,
            boundVia: row.boundVia,
            boundAt: row.created_at,
            displayName: config ? config.displayName : null,
            totpEnabled: config ? Boolean(config.totpEnabled) : null,
            canRestoreTotp: config ? Boolean(config.totpSecret) : false,
        });
    }
    return result;
}

/**
 * 解除綁定（管理用）。實際刪除而非改 status，
 * 因為 (user_id, merchant_id) 有唯一約束，留著會擋住之後重新綁定。
 * 稽核紀錄本來就獨立保存，刪除不會遺失歷程。
 *
 * @param {string} merchantId
 * @returns {Promise<{ removed: boolean, userId: string|null }>}
 */
async function unbindMerchant(merchantId) {
    const trimmed = String(merchantId || '').trim();
    if (!trimmed) {
        return { removed: false, userId: null };
    }

    const existing = await MerchantMember.findOne({
        where: { merchantId: trimmed },
        raw: true,
    });
    if (!existing) {
        return { removed: false, userId: null };
    }

    await MerchantMember.destroy({ where: { merchantId: trimmed } });
    return { removed: true, userId: existing.userId };
}

/**
 * 寫入稽核紀錄。失敗的嘗試也要記，才查得出搶綁行為。
 * 稽核寫入失敗不可影響主流程。
 */
async function recordBindAudit(entry) {
    try {
        await MerchantBindAudit.create({
            userId: entry.userId || null,
            merchantId: entry.merchantId || null,
            action: entry.action,
            method: entry.method || null,
            result: entry.result,
            reason: entry.reason ? String(entry.reason).slice(0, 200) : null,
            ipAddress: entry.ipAddress
                ? String(entry.ipAddress).slice(0, 64)
                : null,
            userAgent: entry.userAgent || null,
            created_at: new Date(),
        });
    } catch (error) {
        console.error('[merchant-member] 稽核寫入失敗:', error.message);
    }
}

module.exports = {
    BIND_ERROR,
    getMembershipsByUserId,
    getActiveMemberByMerchantId,
    isMember,
    bindMerchant,
    listAllMemberships,
    unbindMerchant,
    recordBindAudit,
};
