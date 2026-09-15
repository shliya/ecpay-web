/**
 * better-auth 實例（Google 登入）。
 *
 * 設計說明：
 * - 使用獨立的 pg Pool，不共用 Sequelize 連線。better-auth 內部走 Kysely，
 *   讓它自己管 user / session / account / verification 四張表，
 *   Sequelize 繼續管業務表，兩邊互不干涉。
 * - 正式站的 DATABASE_URL 是 Supabase transaction pooler，連線數有限，
 *   因此這裡的 pool 上限刻意壓低，避免排擠既有的 Sequelize 連線。
 * - 資料表由 umzug 003 建立，不使用 better-auth CLI，
 *   維持「schema 只從 migration 來」的單一來源。
 */
require('dotenv').config();

const { betterAuth } = require('better-auth');
const { Pool } = require('pg');

const isProduction = process.env.NODE_ENV === 'production';

const connectionString = isProduction
    ? process.env.DATABASE_URL
    : process.env.TEST_DB_URL;

if (!connectionString) {
    throw new Error(
        `[auth] 缺少資料庫連線字串（NODE_ENV=${process.env.NODE_ENV} 需要 ` +
            `${isProduction ? 'DATABASE_URL' : 'TEST_DB_URL'}）`
    );
}

if (!process.env.BETTER_AUTH_SECRET) {
    throw new Error(
        '[auth] 缺少 BETTER_AUTH_SECRET。產生方式：' +
            "node -e \"console.log(require('crypto').randomBytes(32).toString('base64url'))\""
    );
}

if (!process.env.BETTER_AUTH_URL) {
    throw new Error(
        '[auth] 缺少 BETTER_AUTH_URL。要填網站根網址（例如 http://localhost:3001），' +
            '不是 callback 完整路徑，否則會產生錯誤的 redirect_uri。'
    );
}

/** better-auth 專用連線池，與 Sequelize 分開 */
const authPool = new Pool({
    connectionString,
    ssl: isProduction ? { require: true, rejectUnauthorized: false } : false,
    max: isProduction ? 2 : 5,
    idleTimeoutMillis: 10000,
    connectionTimeoutMillis: 10000,
    application_name: 'better-auth',
});

/** 允許帶 cookie 的來源，與 index.js 的 CORS 設定同一份來源 */
const trustedOrigins = String(process.env.ALLOWED_ORIGINS || '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);

const hasGoogleCredentials = Boolean(
    process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET
);

if (!hasGoogleCredentials) {
    console.warn(
        '[auth] 未設定 GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET，' +
            'Google 登入不會啟用（其餘 auth 端點仍可運作）'
    );
}

const auth = betterAuth({
    baseURL: process.env.BETTER_AUTH_URL,
    secret: process.env.BETTER_AUTH_SECRET,
    database: authPool,

    // 只開 Google，不提供 email + 密碼註冊
    emailAndPassword: { enabled: false },

    socialProviders: hasGoogleCredentials
        ? {
              google: {
                  clientId: process.env.GOOGLE_CLIENT_ID,
                  clientSecret: process.env.GOOGLE_CLIENT_SECRET,
              },
          }
        : {},

    trustedOrigins: trustedOrigins.length > 0 ? trustedOrigins : undefined,

    session: {
        expiresIn: 60 * 60 * 24 * 7, // 7 天
        updateAge: 60 * 60 * 24, // 每天滾動延長
    },

    advanced: {
        // 正式站走 HTTPS 才加 Secure，否則本機 http 會收不到 cookie
        useSecureCookies: isProduction,
    },
});

module.exports = { auth, authPool, hasGoogleCredentials };
