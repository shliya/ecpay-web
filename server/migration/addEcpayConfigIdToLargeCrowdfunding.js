/**
 * large_crowdfunding_pages / large_crowdfunding_donations 新增 ecpayConfigId
 * 執行：node server/migration/addEcpayConfigIdToLargeCrowdfunding.js
 */
const sequelize = require('../config/database');

const PAGES = 'large_crowdfunding_pages';
const DONATIONS = 'large_crowdfunding_donations';

async function columnExists(table, column) {
    const [rows] = await sequelize.query(
        `
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = :table
          AND LOWER(column_name) = LOWER(:column)
        LIMIT 1
        `,
        { replacements: { table, column } }
    );
    return rows.length > 0;
}

(async () => {
    try {
        if (!(await columnExists(PAGES, 'ecpayConfigId'))) {
            await sequelize.query(`
                ALTER TABLE ${PAGES}
                ADD COLUMN "ecpayConfigId" BIGINT NULL
            `);
            console.log(`${PAGES}.ecpayConfigId 已新增`);
        }

        await sequelize.query(`
            UPDATE ${PAGES} p
            SET "ecpayConfigId" = e.id
            FROM ecpay_config e
            WHERE e."merchantId" = p."merchantId"
              AND p."ecpayConfigId" IS NULL
        `);
        console.log(`${PAGES} 已依 merchantId 回填 ecpayConfigId`);

        await sequelize.query(`
            UPDATE ${PAGES} p
            SET "ecpayConfigId" = e.id
            FROM ecpay_config e
            WHERE e."payuniMerchantId" = p."merchantId"
              AND p."ecpayConfigId" IS NULL
        `);

        const [nullPages] = await sequelize.query(`
            SELECT COUNT(*)::int AS c FROM ${PAGES} WHERE "ecpayConfigId" IS NULL
        `);
        if (nullPages[0].c > 0) {
            console.warn(
                `警告：仍有 ${nullPages[0].c} 筆 ${PAGES} 無法對應 ecpay_config，請手動處理後再設 NOT NULL`
            );
        } else {
            await sequelize.query(`
                ALTER TABLE ${PAGES}
                ALTER COLUMN "ecpayConfigId" SET NOT NULL
            `);
        }

        const [fkPage] = await sequelize.query(`
            SELECT 1 FROM information_schema.table_constraints
            WHERE constraint_name = 'fk_lcf_pages_ecpay_config'
        `);
        if (fkPage.length === 0) {
            await sequelize.query(`
                ALTER TABLE ${PAGES}
                ADD CONSTRAINT fk_lcf_pages_ecpay_config
                FOREIGN KEY ("ecpayConfigId") REFERENCES ecpay_config(id)
            `);
        }

        const [uqNew] = await sequelize.query(`
            SELECT 1 FROM pg_indexes
            WHERE indexname = 'uq_large_crowdfunding_pages_config_page'
        `);
        if (uqNew.length === 0) {
            await sequelize.query(`
                CREATE UNIQUE INDEX uq_large_crowdfunding_pages_config_page
                ON ${PAGES} ("ecpayConfigId", "pageKey")
            `);
        }

        if (!(await columnExists(DONATIONS, 'ecpayConfigId'))) {
            await sequelize.query(`
                ALTER TABLE ${DONATIONS}
                ADD COLUMN "ecpayConfigId" BIGINT NULL
            `);
            console.log(`${DONATIONS}.ecpayConfigId 已新增`);
        }

        await sequelize.query(`
            UPDATE ${DONATIONS} d
            SET "ecpayConfigId" = p."ecpayConfigId"
            FROM ${PAGES} p
            WHERE p.id = d."largeCrowdfundingPageId"
              AND d."ecpayConfigId" IS NULL
        `);
        await sequelize.query(`
            UPDATE ${DONATIONS} d
            SET "ecpayConfigId" = e.id
            FROM ecpay_config e
            WHERE e."merchantId" = d."merchantId"
              AND d."ecpayConfigId" IS NULL
        `);

        const [fkDon] = await sequelize.query(`
            SELECT 1 FROM information_schema.table_constraints
            WHERE constraint_name = 'fk_lcf_donations_ecpay_config'
        `);
        if (fkDon.length === 0) {
            await sequelize.query(`
                ALTER TABLE ${DONATIONS}
                ADD CONSTRAINT fk_lcf_donations_ecpay_config
                FOREIGN KEY ("ecpayConfigId") REFERENCES ecpay_config(id)
            `);
        }

        console.log('addEcpayConfigIdToLargeCrowdfunding 完成');
        process.exit(0);
    } catch (err) {
        console.error('addEcpayConfigIdToLargeCrowdfunding 失敗:', err);
        process.exit(1);
    }
})();
