const { createEcpayConfig } = require('../../service/ecpay-config');
const { assertRegistrationAllowed } = require('../../lib/registration-guard');
const { getAuthSession } = require('../../lib/auth-session');
const {
    BIND_ERROR,
    bindMerchant,
    recordBindAudit,
    getMembershipsByUserId,
} = require('../../store/merchant-member');

/**
 * 建立綠界商店設定。
 *
 * 兩條路徑並存（過渡期）：
 *
 *   A. 已用 Google 登入 —— 新版流程。身分由 Google 承擔，
 *      不需要註冊金鑰，建立後立刻把商店掛到該帳號名下，
 *      不必也不應該再綁 TOTP（totpEnabled 預設就是 false）。
 *
 *   B. 未登入 —— 維持原本的公開註冊閘門，行為完全不變，
 *      讓既有的 ecpay-setting.html 舊流程不受影響。
 *
 * A 路徑會先檢查「這個帳號是否已有商店」再建立，
 * 避免建立成功卻因單店限制綁不上，留下沒有主人的商店。
 */
module.exports = async (req, res) => {
    try {
        const session = await getAuthSession(req);

        if (!session) {
            const gate = assertRegistrationAllowed(req);
            if (!gate.ok) {
                return res.status(gate.status).json({ message: gate.message });
            }
        }

        const { merchantId, hashKey, hashIV } = req.body;

        if (!merchantId || !hashKey || !hashIV) {
            return res.status(400).json({ message: '所有欄位都是必填的' });
        }

        const trimmedMerchantId = String(merchantId).trim();

        // 先擋掉「已有商店」的情況，避免建立出無主商店
        if (session) {
            const existing = await getMembershipsByUserId(session.user.id);
            if (existing.length > 0) {
                return res.status(409).json({
                    message: `此 Google 帳號已綁定商店 ${existing[0].merchantId}`,
                });
            }
        }

        const result = await createEcpayConfig({
            merchantId: trimmedMerchantId,
            hashKey,
            hashIV,
        });

        if (!session) {
            return res
                .status(200)
                .json({ message: '設定已儲存', id: result.id });
        }

        const bound = await bindMerchant({
            userId: session.user.id,
            merchantId: trimmedMerchantId,
            boundVia: 'created',
        });

        await recordBindAudit({
            userId: session.user.id,
            merchantId: trimmedMerchantId,
            action: 'bind',
            method: 'created',
            result: bound.ok ? 'success' : 'failed',
            reason: bound.ok ? 'created_with_merchant' : bound.code,
            ipAddress: req.ip || null,
            userAgent: req.headers['user-agent'] || null,
        });

        if (!bound.ok) {
            // 商店已建立但綁定失敗，明確告知，不要假裝成功
            console.error(
                `[ecpay-setting] 商店 ${trimmedMerchantId} 已建立但綁定失敗: ${bound.code}`
            );
            return res.status(409).json({
                message:
                    bound.code === BIND_ERROR.ALREADY_BOUND_BY_OTHER
                        ? '商店已建立，但已被其他 Google 帳號綁定，請聯絡管理者'
                        : '商店已建立，但綁定失敗，請重新登入後再試',
                id: result.id,
                bound: false,
            });
        }

        res.status(200).json({
            message: '設定已儲存',
            id: result.id,
            bound: true,
            merchantId: trimmedMerchantId,
        });
    } catch (error) {
        console.error('儲存設定時發生錯誤:', error);
        res.status(500).json({ message: '伺服器錯誤' });
    }
};
