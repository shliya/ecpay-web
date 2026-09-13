const { QueryTypes } = require('sequelize');
const sequelize = require('../config/database');

/**
 * better-auth 的 user 表讀取。
 *
 * 這張表由 better-auth（Kysely）託管，Sequelize 沒有對應的 model，
 * 所以用 raw query 讀。用 Sequelize 而不是 better-auth 自己的連線池，
 * 是因為兩者的連線字串來源完全相同（production 走 DATABASE_URL，
 * 其餘走 TEST_DB_URL），指向同一個資料庫；讀一筆資料不值得把
 * better-auth（ESM）整包載進來。
 *
 * 只讀不寫：任何 user 資料的異動都該由 better-auth 自己處理。
 */

/**
 * 以 email 找出已登入過的 Google 使用者。
 * 沒有這個人（從沒登入過）回 null。
 *
 * @param {string} email
 * @returns {Promise<{ id: string, email: string, name: string, emailVerified: boolean } | null>}
 */
async function findAuthUserByEmail(email) {
    const normalized = String(email || '')
        .trim()
        .toLowerCase();
    if (!normalized) {
        return null;
    }

    const rows = await sequelize.query(
        `SELECT "id", "email", "name", "emailVerified"
         FROM "user"
         WHERE lower("email") = :email
         LIMIT 1`,
        {
            replacements: { email: normalized },
            type: QueryTypes.SELECT,
        }
    );

    const row = Array.isArray(rows) ? rows[0] : null;
    return row && row.id ? row : null;
}

module.exports = {
    findAuthUserByEmail,
};
