/**
 * 管理者判定：以 Google 帳號的 email 比對 ADMIN_EMAILS。
 *
 * 為什麼用環境變數而不是資料表欄位：
 *   1. user 表由 better-auth 託管，加欄位要跟著它的 schema 走
 *   2. 管理者名單極少變動，放在部署設定裡反而更安全 ——
 *      沒有任何 API 能把自己升級成管理者，只能改部署設定
 *
 * 未設定 ADMIN_EMAILS 時一律拒絕（fail closed），
 * 避免設定遺漏時變成「所有人都是管理者」。
 */
function getAdminEmails() {
    return String(process.env.ADMIN_EMAILS || '')
        .split(',')
        .map(s => s.trim().toLowerCase())
        .filter(Boolean);
}

/**
 * @param {string} email
 * @returns {boolean}
 */
function isAdminEmail(email) {
    if (!email) {
        return false;
    }
    const admins = getAdminEmails();
    if (admins.length === 0) {
        return false;
    }
    return admins.includes(String(email).trim().toLowerCase());
}

/**
 * 管理者專用中介層。需同時成立：
 *   1. 有效的 Google session
 *   2. email 已被 Google 驗證
 *   3. email 在 ADMIN_EMAILS 名單內
 *
 * 一律回 404 而不是 403：不讓非管理者從回應差異推斷出這支 API 存在。
 */
async function requireAdmin(req, res, next) {
    try {
        // 延後載入：auth-session 會連帶載入 better-auth（ESM），
        // 放在模組頂層會讓只想測 isAdminEmail 的單元測試也被迫載入整個
        // auth 堆疊。判定名單的純邏輯不該依賴它。
        const { getAuthSession } = require('./auth-session');
        const session = await getAuthSession(req);
        const user = session && session.user;

        if (!user || !user.emailVerified || !isAdminEmail(user.email)) {
            if (user) {
                console.warn(
                    `[admin-guard] 非管理者嘗試存取管理 API: ${user.email} ${req.method} ${req.originalUrl}`
                );
            }
            res.status(404).json({ error: 'Not Found' });
            return;
        }

        req.adminUser = user;
        next();
    } catch (error) {
        console.error('[admin-guard] 驗證失敗:', error);
        res.status(500).json({ error: '驗證服務異常' });
    }
}

module.exports = { getAdminEmails, isAdminEmail, requireAdmin };
