/**
 * 建立 better-auth 所需的四張表：user / session / account / verification
 *
 * 欄位定義取自 better-auth v1.7.3 的 getAuthTables()，刻意不使用 better-auth CLI，
 * 以維持「所有 schema 變更都只走 umzug」的單一來源（正式站部署只需 migrate up）。
 *
 * 注意：user 在 PostgreSQL 是保留字，session 也建議引號化，
 *       故本檔所有 SQL 的表名／欄名一律加雙引號。
 * 注意：欄名維持 better-auth 的 camelCase，不可改成 snake_case，
 *       否則需要在 betterAuth() 內逐欄設定 fieldName 對應。
 */

/** @param {{ context: import('sequelize').Sequelize }} params */
async function up({ context: sequelize }) {
    await sequelize.query(`
        CREATE TABLE IF NOT EXISTS "user" (
            "id"            TEXT        PRIMARY KEY,
            "name"          TEXT        NOT NULL,
            "email"         TEXT        NOT NULL UNIQUE,
            "emailVerified" BOOLEAN     NOT NULL DEFAULT false,
            "image"         TEXT,
            "createdAt"     TIMESTAMPTZ NOT NULL DEFAULT now(),
            "updatedAt"     TIMESTAMPTZ NOT NULL DEFAULT now()
        )
    `);

    await sequelize.query(`
        CREATE TABLE IF NOT EXISTS "session" (
            "id"        TEXT        PRIMARY KEY,
            "expiresAt" TIMESTAMPTZ NOT NULL,
            "token"     TEXT        NOT NULL UNIQUE,
            "createdAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
            "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT now(),
            "ipAddress" TEXT,
            "userAgent" TEXT,
            "userId"    TEXT        NOT NULL
                REFERENCES "user"("id") ON DELETE CASCADE
        )
    `);

    await sequelize.query(`
        CREATE TABLE IF NOT EXISTS "account" (
            "id"                    TEXT        PRIMARY KEY,
            "accountId"             TEXT        NOT NULL,
            "providerId"            TEXT        NOT NULL,
            "userId"                TEXT        NOT NULL
                REFERENCES "user"("id") ON DELETE CASCADE,
            "accessToken"           TEXT,
            "refreshToken"          TEXT,
            "idToken"               TEXT,
            "accessTokenExpiresAt"  TIMESTAMPTZ,
            "refreshTokenExpiresAt" TIMESTAMPTZ,
            "scope"                 TEXT,
            "password"              TEXT,
            "createdAt"             TIMESTAMPTZ NOT NULL DEFAULT now(),
            "updatedAt"             TIMESTAMPTZ NOT NULL DEFAULT now()
        )
    `);

    await sequelize.query(`
        CREATE TABLE IF NOT EXISTS "verification" (
            "id"         TEXT        PRIMARY KEY,
            "identifier" TEXT        NOT NULL,
            "value"      TEXT        NOT NULL,
            "expiresAt"  TIMESTAMPTZ NOT NULL,
            "createdAt"  TIMESTAMPTZ NOT NULL DEFAULT now(),
            "updatedAt"  TIMESTAMPTZ NOT NULL DEFAULT now()
        )
    `);

    // 查詢熱點索引
    await sequelize.query(`
        CREATE INDEX IF NOT EXISTS "idx_session_userId"
        ON "session" ("userId")
    `);
    await sequelize.query(`
        CREATE INDEX IF NOT EXISTS "idx_session_expiresAt"
        ON "session" ("expiresAt")
    `);
    await sequelize.query(`
        CREATE INDEX IF NOT EXISTS "idx_account_userId"
        ON "account" ("userId")
    `);
    // 同一個 provider 的同一個外部帳號只會有一筆
    await sequelize.query(`
        CREATE UNIQUE INDEX IF NOT EXISTS "uq_account_provider_accountId"
        ON "account" ("providerId", "accountId")
    `);
    await sequelize.query(`
        CREATE INDEX IF NOT EXISTS "idx_verification_identifier"
        ON "verification" ("identifier")
    `);
}

/** @param {{ context: import('sequelize').Sequelize }} params */
async function down({ context: sequelize }) {
    // 依外鍵相依性反序丟棄
    await sequelize.query('DROP TABLE IF EXISTS "verification"');
    await sequelize.query('DROP TABLE IF EXISTS "account"');
    await sequelize.query('DROP TABLE IF EXISTS "session"');
    await sequelize.query('DROP TABLE IF EXISTS "user"');
}

module.exports = { up, down };
