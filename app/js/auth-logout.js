/**
 * 完整登出。
 *
 * 身分現在同時存在兩個地方，缺一邊清就等於沒登出：
 *   - Google session 在 httpOnly cookie，只有伺服器清得掉
 *   - 舊版的商店憑證在 localStorage（totpSession_*）
 *
 * 只清 localStorage → cookie 還在，回到登入頁會被直接導回後台，
 *                     看起來就像「登出沒有作用」。
 * 只呼叫 sign-out   → localStorage 還留著舊 token，舊的 TOTP 路徑仍進得去。
 */
const SESSION_KEY_PREFIX = 'totpSession_';

function clearLocalCredentials() {
    try {
        localStorage.removeItem('merchantId');

        // 先收集再刪除：邊迭代邊刪會讓索引位移而漏掉項目
        const staleKeys = [];
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && key.startsWith(SESSION_KEY_PREFIX)) {
                staleKeys.push(key);
            }
        }
        staleKeys.forEach(key => localStorage.removeItem(key));
    } catch {
        // 無痕模式或停用儲存空間時會擲出，忽略即可
    }
}

/**
 * 登出並導向指定頁面。
 * 伺服器沒回應時仍然清除本機憑證並離開，讓狀態回到起點。
 *
 * @param {string} [redirectTo]
 */
async function signOutAll(redirectTo = '/login.html') {
    try {
        await fetch('/api/auth/sign-out', {
            method: 'POST',
            credentials: 'same-origin',
            headers: { 'Content-Type': 'application/json' },
        });
    } catch {
        // 忽略：本機憑證還是要清掉
    }

    clearLocalCredentials();
    window.location.href = redirectTo;
}

export { signOutAll, clearLocalCredentials };
