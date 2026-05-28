/**
 * large_crowdfunding_pages 新增 status（1=啟動 2=結束 3=刪除）
 *
 * 執行：node server/migration/addStatusToLargeCrowdfundingPages.js
 */
const sequelize = require('../config/database');

const TABLE = 'large_crowdfunding_pages';

(async () => {
    try {
        const [rows] = await sequelize.query(
            `
            SELECT column_name
            FROM information_schema.columns
            WHERE table_schema = 'public'
              AND table_name = :tableName
              AND column_name = 'status'
            `,
            { replacements: { tableName: TABLE } }
        );

        if (rows.length > 0) {
            console.log('status 欄位已存在，跳過');
            process.exit(0);
        }

        await sequelize.query(`
            ALTER TABLE ${TABLE}
            ADD COLUMN status SMALLINT NOT NULL DEFAULT 1
        `);

        await sequelize.query(`
            UPDATE ${TABLE}
            SET status = 1
            WHERE status IS NULL
        `);

        console.log(`${TABLE}.status 新增完成`);
        process.exit(0);
    } catch (error) {
        console.error('新增 status 欄位失敗:', error);
        process.exit(1);
    }
})();
