/**
 * 建立大型募資 Phase 2 資料表：
 *   - large_crowdfunding_pages（活動設定，對應 default.json 主體）
 *   - large_crowdfunding_donations（斗內紀錄／近期榜單）
 *
 * 執行：node server/migration/createLargeCrowdfundingTables.js
 */
const sequelize = require('../config/database');

const PAGES_TABLE = 'large_crowdfunding_pages';
const DONATIONS_TABLE = 'large_crowdfunding_donations';

async function tableExists(tableName) {
    const [rows] = await sequelize.query(
        `
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name = :tableName
        LIMIT 1
        `,
        { replacements: { tableName } }
    );
    return rows.length > 0;
}

(async () => {
    try {
        if (await tableExists(PAGES_TABLE)) {
            console.log(`${PAGES_TABLE} 已存在，跳過建表`);
        } else {
            console.log(`建立 ${PAGES_TABLE}...`);
            await sequelize.query(`
                CREATE TABLE ${PAGES_TABLE} (
                    id BIGSERIAL PRIMARY KEY,
                    "ecpayConfigId" BIGINT NOT NULL
                        REFERENCES ecpay_config(id),
                    "merchantId" VARCHAR(50) NOT NULL,
                    "pageKey" VARCHAR(80) NOT NULL,
                    "largeFundraisingName" VARCHAR(200) NOT NULL DEFAULT '',
                    title VARCHAR(200) NOT NULL DEFAULT '',
                    "sponsorLabel" TEXT NOT NULL DEFAULT '',
                    "fundraisingStartsAt" TIMESTAMPTZ NULL,
                    "fundraisingEndsAt" TIMESTAMPTZ NULL,
                    "manuallyClosed" BOOLEAN NOT NULL DEFAULT FALSE,
                    "backgroundImageUrl" TEXT NOT NULL DEFAULT '',
                    "heroImageUrl" TEXT NOT NULL DEFAULT '',
                    "donorListBackgroundImageUrl" TEXT NOT NULL DEFAULT '',
                    "mainDonorListTitle" TEXT NOT NULL DEFAULT '',
                    "specialThemeRankingTitle" TEXT NOT NULL DEFAULT '',
                    "donorTierIcons" JSONB NOT NULL DEFAULT '{}'::jsonb,
                    "specialThemeTierIconUrl" TEXT NOT NULL DEFAULT '',
                    theme JSONB NOT NULL DEFAULT '{}'::jsonb,
                    "contentBlocks" JSONB NOT NULL DEFAULT '[]'::jsonb,
                    milestones JSONB NOT NULL DEFAULT '[]'::jsonb,
                    "currentTotal" INTEGER NOT NULL DEFAULT 0
                        CHECK ("currentTotal" >= 0),
                    "publishedAt" TIMESTAMPTZ NULL,
                    status SMALLINT NOT NULL DEFAULT 1,
                    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                    CONSTRAINT uq_large_crowdfunding_pages_config_page
                        UNIQUE ("ecpayConfigId", "pageKey")
                )
            `);
            await sequelize.query(`
                CREATE INDEX idx_large_crowdfunding_pages_page_key
                ON ${PAGES_TABLE} ("pageKey")
            `);
            console.log(`${PAGES_TABLE} 建立完成`);
        }

        if (await tableExists(DONATIONS_TABLE)) {
            console.log(`${DONATIONS_TABLE} 已存在，跳過建表`);
        } else {
            console.log(`建立 ${DONATIONS_TABLE}...`);
            await sequelize.query(`
                CREATE TABLE ${DONATIONS_TABLE} (
                    id BIGSERIAL PRIMARY KEY,
                    "largeCrowdfundingPageId" BIGINT NOT NULL
                        REFERENCES ${PAGES_TABLE}(id) ON DELETE CASCADE,
                    "ecpayConfigId" BIGINT NOT NULL
                        REFERENCES ecpay_config(id),
                    "merchantId" VARCHAR(50) NOT NULL,
                    "pageKey" VARCHAR(80) NOT NULL,
                    "donorName" VARCHAR(100) NOT NULL,
                    amount INTEGER NOT NULL
                        CHECK (amount > 0),
                    message TEXT NULL,
                    "sourceDonationId" BIGINT NULL
                        REFERENCES donations(id) ON DELETE SET NULL,
                    payment_trade_no VARCHAR(50) NULL,
                    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
                )
            `);
            await sequelize.query(`
                CREATE INDEX idx_lcf_donations_page_created
                ON ${DONATIONS_TABLE} ("largeCrowdfundingPageId", created_at DESC)
            `);
            await sequelize.query(`
                CREATE INDEX idx_lcf_donations_page_amount
                ON ${DONATIONS_TABLE} ("largeCrowdfundingPageId", amount DESC)
            `);
            await sequelize.query(`
                CREATE INDEX idx_lcf_donations_page_key_created
                ON ${DONATIONS_TABLE} ("pageKey", created_at DESC)
            `);
            await sequelize.query(`
                CREATE INDEX idx_lcf_donations_source_donation
                ON ${DONATIONS_TABLE} ("sourceDonationId")
                WHERE "sourceDonationId" IS NOT NULL
            `);
            await sequelize.query(`
                CREATE UNIQUE INDEX uq_lcf_donations_payment_trade_no
                ON ${DONATIONS_TABLE} (payment_trade_no)
                WHERE payment_trade_no IS NOT NULL
            `);
            console.log(`${DONATIONS_TABLE} 建立完成`);
        }

        console.log('大型募資資料表 migration 完成');
        process.exit(0);
    } catch (err) {
        console.error('createLargeCrowdfundingTables 失敗:', err);
        process.exit(1);
    }
})();
