const { getAuthSession } = require('../../lib/auth-session');
const {
    getEcpayConfigByMerchantId,
    updateEcpayConfig,
} = require('../../store/ecpay-config');
const { verifyMerchantToken } = require('../../lib/merchant-totp-verify');
const {
    BIND_ERROR,
    bindMerchant,
    recordBindAudit,
} = require('../../store/merchant-member');

/** 綁定失敗原因 → HTTP 回應 */
const BIND_ERROR_RESPONSE = {
    [BIND_ERROR.MERCHANT_NOT_FOUND]: { status: 404, error: '商店不存在' },
    [BIND_ERROR.ALREADY_BOUND_BY_OTHER]: {
        status: 409,
        error: '這間商店已綁定其他 Google 帳號，如有疑問請聯絡管理者',
    },
    [BIND_ERROR.USER_HAS_OTHER_MERCHANT]: {
        status: 409,
        error: '此 Google 帳號已綁定其他商店',
    },
};

/**
 * 將已登入的 Google 帳號與商店綁定。
 *
 * 需要同時成立兩件事：
 *   1. 有效的 Google session（cookie）—— 證明「你是誰」
 *   2. 有效的 TOTP 驗證碼或 session token —— 證明「這間店是你的」
 *
 * 兩者缺一不可，成功與失敗都會寫入稽核。
 */
module.exports = async (req, res) => {
    const ipAddress = req.ip || null;
    const userAgent = req.headers['user-agent'] || null;
    const merchantId = String(req.body?.merchantId || '').trim();

    try {
        const session = await getAuthSession(req);
        if (!session) {
            res.status(401).json({ error: '請先使用 Google 登入' });
            return;
        }

        const userId = session.user.id;

        if (!merchantId) {
            res.status(400).json({ error: '缺少商店代號' });
            return;
        }

        const config = await getEcpayConfigByMerchantId(merchantId);
        if (!config) {
            await recordBindAudit({
                userId,
                merchantId,
                action: 'bind',
                result: 'failed',
                reason: 'merchant_not_found',
                ipAddress,
                userAgent,
            });
            res.status(404).json({ error: '商店不存在' });
            return;
        }

        const verification = verifyMerchantToken({
            config,
            merchantId,
            token: req.headers['x-totp-token'] || req.body?.token,
        });

        if (!verification.ok) {
            await recordBindAudit({
                userId,
                merchantId,
                action: 'bind',
                result: 'failed',
                reason: verification.reason,
                ipAddress,
                userAgent,
            });
            res.status(401).json({
                error: '商店驗證失敗，請重新輸入驗證碼',
            });
            return;
        }

        const result = await bindMerchant({
            userId,
            merchantId,
            boundVia: verification.method,
        });

        if (!result.ok) {
            await recordBindAudit({
                userId,
                merchantId,
                action: 'bind',
                method: verification.method,
                result: 'failed',
                reason: result.code,
                ipAddress,
                userAgent,
            });
            const response = BIND_ERROR_RESPONSE[result.code] || {
                status: 400,
                error: '綁定失敗',
            };
            res.status(response.status).json({ error: response.error });
            return;
        }

        // 綁定完成即視為遷移到 Google 登入，關閉舊的 TOTP 機制。
        // 刻意保留 totpSecret：只翻旗標不刪金鑰，萬一要回退可以直接開回來，
        // 使用者也不必重新掃 QR code。
        let totpDisabled = false;
        if (result.created && config.totpEnabled) {
            try {
                await updateEcpayConfig(merchantId, { totpEnabled: false });
                totpDisabled = true;
            } catch (error) {
                // 關閉失敗不影響綁定結果，下次登入仍可用 Google
                console.error('[me] 關閉 TOTP 失敗:', error.message);
            }
        }

        await recordBindAudit({
            userId,
            merchantId,
            action: 'bind',
            method: verification.method,
            result: 'success',
            reason: result.created ? 'created' : 'already_bound',
            ipAddress,
            userAgent,
        });

        res.json({
            success: true,
            created: result.created,
            merchantId,
            displayName: config.displayName || null,
            totpDisabled,
        });
    } catch (error) {
        console.error('[me] 綁定商店失敗:', error);
        await recordBindAudit({
            merchantId,
            action: 'bind',
            result: 'failed',
            reason: 'server_error',
            ipAddress,
            userAgent,
        });
        res.status(500).json({ error: '伺服器錯誤' });
    }
};
