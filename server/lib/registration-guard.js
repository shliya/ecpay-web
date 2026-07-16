const { safeEqualString } = require('./safe-equal');

/**
 * 公開註冊閘門：正式環境必須帶 REGISTRATION_SECRET。
 * 本地未設定時仍可註冊（方便開發）；一旦設定則一律驗證。
 *
 * @param {import('express').Request} req
 * @returns {{ ok: true }|{ ok: false, status: number, message: string }}
 */
function assertRegistrationAllowed(req) {
    const expected = String(process.env.REGISTRATION_SECRET || '').trim();
    const isProd = process.env.NODE_ENV === 'production';

    if (!expected) {
        if (isProd) {
            return {
                ok: false,
                status: 403,
                message: '公開註冊已關閉，請聯絡管理員開通商店',
            };
        }
        return { ok: true };
    }

    if (expected.length < 16) {
        return {
            ok: false,
            status: 500,
            message: '伺服器註冊設定異常',
        };
    }

    const provided = String(
        req.headers['x-registration-secret'] ||
            req.body?.registrationSecret ||
            ''
    ).trim();

    if (!safeEqualString(provided, expected)) {
        return {
            ok: false,
            status: 403,
            message: '註冊金鑰錯誤或未提供',
        };
    }

    return { ok: true };
}

module.exports = {
    assertRegistrationAllowed,
};
