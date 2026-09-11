/**
 * 建立 Google 登入身分與商店的對應關係（方案 A3）。
 *
 * merchant_member      user ↔ ecpay_config.merchantId 的多對多對應表
 * merchant_bind_audit  綁定／解綁的稽核紀錄（涉及金流權限，需可追查）
 *
 * A3 設計說明：
 *   schema 層允許「一個 user 對多間商店」與「一間商店對多個 user」，
 *   目前階段由『應用層』限制成單店（綁定 API 檢查是否已有 membership）。
 *   未來要開放多店時，只需移除應用層限制並補上選店頁，資料庫不需異動。
 *   → 因此這裡刻意「不」加 UNIQUE (user_id)。
 *
 * 刻意不對 ecpay_config 建外鍵：
 *   本專案既有 Sequelize 關聯一律 constraints: false，
 *   且 merchant_id 需容忍商店資料的既有調整流程，故僅建索引。
 */
const MEMBER_TABLE = 'merchant_member';
const AUDIT_TABLE = 'merchant_bind_audit';

/** @param {{ context: import('sequelize').Sequelize }} params */
async function up({ context: sequelize }) {
    await sequelize.query(`
        CREATE TABLE IF NOT EXISTS ${MEMBER_TABLE} (
            id          BIGSERIAL   PRIMARY KEY,
            user_id     TEXT        NOT NULL
                REFERENCES "user"("id") ON DELETE CASCADE,
            merchant_id VARCHAR(50) NOT NULL,
            role        VARCHAR(20) NOT NULL DEFAULT 'owner',
            status      VARCHAR(20) NOT NULL DEFAULT 'active',
            bound_via   VARCHAR(20),
            created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
            updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
            CONSTRAINT uq_merchant_member_user_merchant
                UNIQUE (user_id, merchant_id)
        )
    `);

    await sequelize.query(`
        CREATE INDEX IF NOT EXISTS idx_merchant_member_merchant_id
        ON ${MEMBER_TABLE} (merchant_id)
    `);
    await sequelize.query(`
        CREATE INDEX IF NOT EXISTS idx_merchant_member_user_id
        ON ${MEMBER_TABLE} (user_id)
    `);

    await sequelize.query(`
        CREATE TABLE IF NOT EXISTS ${AUDIT_TABLE} (
            id          BIGSERIAL   PRIMARY KEY,
            user_id     TEXT,
            merchant_id VARCHAR(50),
            action      VARCHAR(20) NOT NULL,
            method      VARCHAR(20),
            result      VARCHAR(20) NOT NULL,
            reason      VARCHAR(200),
            ip_address  VARCHAR(64),
            user_agent  TEXT,
            created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
        )
    `);

    await sequelize.query(`
        CREATE INDEX IF NOT EXISTS idx_merchant_bind_audit_merchant
        ON ${AUDIT_TABLE} (merchant_id, created_at DESC)
    `);
    await sequelize.query(`
        CREATE INDEX IF NOT EXISTS idx_merchant_bind_audit_user
        ON ${AUDIT_TABLE} (user_id)
    `);

    await sequelize.query(`
        COMMENT ON COLUMN ${MEMBER_TABLE}.role IS
        'owner / member；目前一律 owner，未來多店協作才會出現 member'
    `);
    await sequelize.query(`
        COMMENT ON COLUMN ${MEMBER_TABLE}.bound_via IS
        '此筆綁定的驗證方式：totp / hashkey'
    `);
    await sequelize.query(`
        COMMENT ON COLUMN ${AUDIT_TABLE}.action IS 'bind / unbind'
    `);
    await sequelize.query(`
        COMMENT ON COLUMN ${AUDIT_TABLE}.result IS 'success / failed'
    `);
    // 稽核表刻意不設外鍵：使用者被刪除後仍須保留綁定歷程
}

/** @param {{ context: import('sequelize').Sequelize }} params */
async function down({ context: sequelize }) {
    await sequelize.query(`DROP TABLE IF EXISTS ${AUDIT_TABLE}`);
    await sequelize.query(`DROP TABLE IF EXISTS ${MEMBER_TABLE}`);
}

module.exports = { up, down };
