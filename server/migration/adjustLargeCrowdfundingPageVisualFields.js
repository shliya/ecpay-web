/**
 * large_crowdfunding_pages：
 *   - 新增 specialThemeTierIcons
 *   - 移除 periodLabel、logoImageUrl
 *
 * 執行：node server/migration/adjustLargeCrowdfundingPageVisualFields.js
 */
const sequelize = require('../config/database');

const TABLE = 'large_crowdfunding_pages';

(async () => {
    try {
        const [specialCol] = await sequelize.query(
            `
            SELECT column_name
            FROM information_schema.columns
            WHERE table_schema = 'public'
              AND table_name = :tableName
              AND column_name = 'specialThemeTierIcons'
            `,
            { replacements: { tableName: TABLE } }
        );

        if (specialCol.length === 0) {
            await sequelize.query(`
                ALTER TABLE ${TABLE}
                ADD COLUMN "specialThemeTierIcons" JSONB NOT NULL DEFAULT '{}'::jsonb
            `);
            console.log(`${TABLE}.specialThemeTierIcons 新增完成`);
        } else {
            console.log('specialThemeTierIcons 欄位已存在，跳過');
        }

        for (const col of ['periodLabel', 'logoImageUrl']) {
            const [rows] = await sequelize.query(
                `
                SELECT column_name
                FROM information_schema.columns
                WHERE table_schema = 'public'
                  AND table_name = :tableName
                  AND column_name = :columnName
                `,
                {
                    replacements: {
                        tableName: TABLE,
                        columnName: col,
                    },
                }
            );

            if (rows.length === 0) {
                console.log(`${col} 欄位不存在，跳過`);
                continue;
            }

            await sequelize.query(`
                ALTER TABLE ${TABLE}
                DROP COLUMN "${col}"
            `);
            console.log(`${TABLE}.${col} 已移除`);
        }

        process.exit(0);
    } catch (error) {
        console.error('調整 large_crowdfunding_pages 欄位失敗:', error);
        process.exit(1);
    }
})();
