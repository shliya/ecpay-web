const { getEcpayConfigByMerchantId } = require('../store/ecpay-config');
const {
    VERIFY_REASON,
    verifyMerchantToken,
} = require('../lib/merchant-totp-verify');
const {
    checkTotpAttempt,
    recordTotpFailure,
    recordTotpSuccess,
} = require('../lib/totp-attempt-limiter');

/** 驗證失敗原因 → HTTP 回應，維持與重構前完全相同的狀態碼與訊息 */
const REASON_RESPONSE = {
    [VERIFY_REASON.TOTP_NOT_ENABLED]: {
        status: 403,
        error: '尚未綁定 TOTP，請先完成綁定後再使用後台功能',
    },
    [VERIFY_REASON.MISSING_TOKEN]: {
        status: 401,
        error: '需要 TOTP 驗證碼',
    },
    [VERIFY_REASON.TOTP_SECRET_ERROR]: {
        status: 500,
        error: 'TOTP 設定異常',
    },
    [VERIFY_REASON.INVALID_TOKEN]: {
        status: 401,
        error: 'TOTP 驗證碼錯誤或已過期',
    },
};

function extractMerchantId(req) {
    return req.params.merchantId || req.body?.merchantId || null;
}

async function requireTotp(req, res, next) {
    try {
        const merchantId = extractMerchantId(req);
        if (!merchantId) {
            res.status(400).json({ error: '缺少 merchantId' });
            return;
        }

        const trimmedMerchantId = String(merchantId).trim();

        // 這裡是後台 TOTP 驗證的唯一入口，猜碼的流量一定會經過，
        // 所以鎖定判斷放在查資料庫之前，被鎖時連 DB 都不用打
        const ip = req.ip || null;
        const gate = checkTotpAttempt({ merchantId: trimmedMerchantId, ip });
        if (!gate.allowed) {
            res.set('Retry-After', String(gate.retryAfterSec));
            res.status(429).json({
                error: '驗證碼錯誤次數過多，請稍後再試',
                retryAfterSec: gate.retryAfterSec,
            });
            return;
        }

        const config = await getEcpayConfigByMerchantId(trimmedMerchantId);
        if (!config) {
            res.status(404).json({ error: '商店不存在' });
            return;
        }

        const result = verifyMerchantToken({
            config,
            merchantId: trimmedMerchantId,
            token: req.headers['x-totp-token'],
        });

        if (result.ok) {
            recordTotpSuccess({ merchantId: trimmedMerchantId, ip });
            next();
            return;
        }

        // 只有「token 真的錯了」才算一次猜測；沒帶 token 或商店沒啟用 TOTP
        // 是設定狀態問題，計入會讓正常使用者被誤鎖
        if (result.reason === VERIFY_REASON.INVALID_TOKEN) {
            recordTotpFailure({ merchantId: trimmedMerchantId, ip });
        }

        const response = REASON_RESPONSE[result.reason] || {
            status: 401,
            error: 'TOTP 驗證碼錯誤或已過期',
        };
        res.status(response.status).json({ error: response.error });
    } catch (error) {
        console.error('[require-totp] 驗證失敗:', error);
        res.status(500).json({ error: '驗證服務異常' });
    }
}

module.exports = requireTotp;
