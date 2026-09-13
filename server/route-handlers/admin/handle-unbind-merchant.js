const {
    getEcpayConfigByMerchantId,
    updateEcpayConfig,
} = require('../../store/ecpay-config');
const {
    unbindMerchant,
    recordBindAudit,
} = require('../../store/merchant-member');

/**
 * 解除商店與 Google 帳號的綁定（僅限管理者）。
 *
 * 解綁後會嘗試把 TOTP 開回來，讓原本的擁有者至少還有一條路可以登入 ——
 * 前提是該商店留有 totpSecret（綁定時只翻旗標、沒有刪金鑰）。
 *
 * 若商店當初是「Google 登入後直接新增」的，它從來沒有 TOTP，
 * 解綁後會變成沒有任何人能登入的狀態，回應中的 totpRestored=false
 * 就是在提醒這件事。
 */
module.exports = async (req, res) => {
    const merchantId = String(req.params.merchantId || '').trim();
    const adminEmail = req.adminUser ? req.adminUser.email : null;

    try {
        if (!merchantId) {
            res.status(400).json({ error: '缺少商店代號' });
            return;
        }

        const config = await getEcpayConfigByMerchantId(merchantId);
        if (!config) {
            res.status(404).json({ error: '商店不存在' });
            return;
        }

        const result = await unbindMerchant(merchantId);
        if (!result.removed) {
            res.status(404).json({ error: '這間商店目前沒有綁定任何帳號' });
            return;
        }

        let totpRestored = false;
        if (config.totpSecret) {
            try {
                await updateEcpayConfig(merchantId, { totpEnabled: true });
                totpRestored = true;
            } catch (error) {
                console.error('[admin] 還原 TOTP 失敗:', error.message);
            }
        }

        await recordBindAudit({
            userId: result.userId,
            merchantId,
            action: 'unbind',
            method: 'admin',
            result: 'success',
            reason: `by:${adminEmail}`,
            ipAddress: req.ip || null,
            userAgent: req.headers['user-agent'] || null,
        });

        console.warn(
            `[admin] ${adminEmail} 解除了商店 ${merchantId} 的綁定（原帳號 ${result.userId}）`
        );

        res.json({
            success: true,
            merchantId,
            unboundUserId: result.userId,
            totpRestored,
            warning: totpRestored
                ? null
                : '這間商店沒有 TOTP 金鑰可還原，解綁後將無人能登入，請盡快重新綁定',
        });
    } catch (error) {
        console.error('[admin] 解除綁定失敗:', error);
        await recordBindAudit({
            merchantId,
            action: 'unbind',
            method: 'admin',
            result: 'failed',
            reason: 'server_error',
            ipAddress: req.ip || null,
            userAgent: req.headers['user-agent'] || null,
        });
        res.status(500).json({ error: '伺服器錯誤' });
    }
};
