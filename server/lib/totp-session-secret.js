/**
 * TOTP 24h session token 的 HMAC 密鑰；啟動時必須設定。
 * @returns {string}
 */
function getTotpSessionSecret() {
    const secret = String(process.env.TOTP_SESSION_SECRET || '').trim();
    if (!secret || secret.length < 16) {
        throw new Error('TOTP_SESSION_SECRET 環境變數需至少 16 字元');
    }
    return secret;
}

module.exports = {
    getTotpSessionSecret,
};
