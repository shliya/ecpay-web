const { getEcpayConfigByMerchantId } = require('../../store/ecpay-config');
const { findAuthUserByEmail } = require('../../store/auth-user');
const {
    BIND_ERROR,
    bindMerchant,
    getActiveMemberByMerchantId,
    recordBindAudit,
} = require('../../store/merchant-member');

/** 綁定失敗原因 → HTTP 回應 */
const BIND_ERROR_RESPONSE = {
    [BIND_ERROR.MERCHANT_NOT_FOUND]: { status: 404, error: '商店不存在' },
    [BIND_ERROR.ALREADY_BOUND_BY_OTHER]: {
        status: 409,
        error: '這間商店已綁定其他帳號，請先解除綁定',
    },
    [BIND_ERROR.USER_HAS_OTHER_MERCHANT]: {
        status: 409,
        error: '這個帳號已經綁定其他商店',
    },
};

/**
 * 管理者把商店指定綁給某個 Google 帳號（僅限管理者）。
 *
 * 為什麼需要這支：解除綁定後，若該商店當初是「Google 登入後直接新增」的，
 * 它從來沒有 totpSecret，解綁後就變成沒有任何人能登入的孤兒商店 ——
 * 一般使用者的綁定流程需要 TOTP 或金流 Hash Key 證明所有權，這兩樣它都沒有。
 * 全面改用 Google 登入之後，這會是唯一的救援路徑。
 *
 * 用 email 而不是 userId 指定對象：管理者手上有的是對方的 Google 信箱，
 * 而 userId 是 better-auth 內部的識別碼，沒有任何介面會顯示。
 * 對方必須至少用 Google 登入過一次，否則系統裡還不存在這個人。
 *
 * 刻意不動 totpEnabled：這是救援路徑，保留商店原本的 TOTP 狀態當退路，
 * 萬一綁錯帳號，原擁有者還有另一扇門。要關閉請走設定頁。
 */
module.exports = async (req, res) => {
    const ipAddress = req.ip || null;
    const userAgent = req.headers['user-agent'] || null;
    const adminEmail = req.adminUser ? req.adminUser.email : null;
    const merchantId = String(req.body?.merchantId || '').trim();
    const email = String(req.body?.email || '').trim();

    try {
        if (!merchantId || !email) {
            res.status(400).json({ error: '請提供商店代號與 Google 帳號信箱' });
            return;
        }

        const config = await getEcpayConfigByMerchantId(merchantId);
        if (!config) {
            res.status(404).json({ error: '商店不存在' });
            return;
        }

        // 已經有人綁著就不讓覆蓋：轉移所有權要先明確解綁，
        // 免得一個打錯的 email 就把商店從現任擁有者手上轉走
        const existing = await getActiveMemberByMerchantId(merchantId);
        if (existing) {
            res.status(409).json({
                error: '這間商店已綁定帳號，請先解除綁定再指定新的擁有者',
                boundUserId: existing.userId,
            });
            return;
        }

        const user = await findAuthUserByEmail(email);
        if (!user) {
            res.status(404).json({
                error: '找不到這個帳號，請先請對方用 Google 登入一次再重試',
            });
            return;
        }

        const bound = await bindMerchant({
            userId: user.id,
            merchantId,
            boundVia: 'admin',
        });

        await recordBindAudit({
            userId: user.id,
            merchantId,
            action: 'bind',
            method: 'admin',
            result: bound.ok ? 'success' : 'failed',
            reason: bound.ok
                ? `admin:${adminEmail || 'unknown'}`
                : `${bound.code} admin:${adminEmail || 'unknown'}`,
            ipAddress,
            userAgent,
        });

        if (!bound.ok) {
            const response = BIND_ERROR_RESPONSE[bound.code] || {
                status: 400,
                error: '綁定失敗',
            };
            res.status(response.status).json({ error: response.error });
            return;
        }

        console.warn(
            `[admin] ${adminEmail} 將商店 ${merchantId} 指定綁定給 ${user.email}`
        );

        res.status(201).json({
            success: true,
            merchantId,
            displayName: config.displayName || null,
            user: {
                id: user.id,
                email: user.email,
                name: user.name || null,
            },
            // 回報而不是修改：讓管理者知道這間店還有沒有 TOTP 這扇門
            totpEnabled: Boolean(config.totpEnabled),
        });
    } catch (error) {
        console.error('[admin] 指定綁定失敗:', error);
        await recordBindAudit({
            merchantId,
            action: 'bind',
            method: 'admin',
            result: 'failed',
            reason: `server_error admin:${adminEmail || 'unknown'}`,
            ipAddress,
            userAgent,
        });
        res.status(500).json({ error: '伺服器錯誤' });
    }
};
