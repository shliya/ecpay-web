const { fromNodeHeaders } = require('better-auth/node');
const { auth } = require('./auth');

/**
 * 從 Express request 取出 better-auth 的登入 session。
 * 取不到或發生錯誤一律回 null，由呼叫端決定要不要退回其他驗證方式。
 *
 * @param {import('express').Request} req
 * @returns {Promise<{ user: object, session: object } | null>}
 */
async function getAuthSession(req) {
    try {
        const result = await auth.api.getSession({
            headers: fromNodeHeaders(req.headers),
        });
        return result && result.user ? result : null;
    } catch (error) {
        console.error('[auth-session] 取得 session 失敗:', error.message);
        return null;
    }
}

module.exports = { getAuthSession };
