const requireTotp = require('./require-totp');
const { getAuthSession } = require('../lib/auth-session');
const { isMember } = require('../store/merchant-member');

function extractMerchantId(req) {
    return req.params.merchantId || req.body?.merchantId || null;
}

/**
 * 商店後台的雙軌驗證（過渡期並存）：
 *
 *   1. 有 Google session 且是該商店的成員 → 放行
 *   2. 其他情況 → 完全交回既有的 TOTP 驗證，行為不變
 *
 * 第 1 條刻意不檢查 ecpay_config.totpEnabled：
 * 新商店不再綁 TOTP，身分由 Google 承擔，若沿用 requireTotp 的檢查
 * 會被「尚未綁定 TOTP」擋下。
 *
 * 有 Google session 但不是成員時，不直接回 403 而是往下走 TOTP，
 * 讓尚未完成綁定的舊使用者仍可用原本的方式操作。這不會放寬安全性：
 * 他依然必須提出該商店的有效 TOTP／session token。
 */
async function requireMerchantAuth(req, res, next) {
    try {
        const merchantId = extractMerchantId(req);
        if (!merchantId) {
            res.status(400).json({ error: '缺少 merchantId' });
            return;
        }

        const session = await getAuthSession(req);
        if (session && session.user && session.user.id) {
            const allowed = await isMember(
                session.user.id,
                String(merchantId).trim()
            );
            if (allowed) {
                req.authUser = session.user;
                next();
                return;
            }
        }

        requireTotp(req, res, next);
    } catch (error) {
        console.error('[require-merchant-auth] 驗證失敗:', error);
        res.status(500).json({ error: '驗證服務異常' });
    }
}

module.exports = requireMerchantAuth;
