/**
 * specialThemeTierIcons (JSONB) → specialThemeTierIconUrl (TEXT，全榜單共用一張圖)
 *
 * 執行：node server/migration/specialThemeTierIconUrlColumn.js
 */
const sequelize = require('../config/database');

const TABLE = 'large_crowdfunding_pages';

(async () => {
    try {
        const [urlCol] = await sequelize.query(
            `
            SELECT column_name
            FROM information_schema.columns
            WHERE table_schema = 'public'
              AND table_name = :tableName
              AND column_name = 'specialThemeTierIconUrl'
            `,
            { replacements: { tableName: TABLE } }
        );

        if (urlCol.length === 0) {
            await sequelize.query(`
                ALTER TABLE ${TABLE}
                ADD COLUMN "specialThemeTierIconUrl" TEXT NOT NULL DEFAULT ''
            `);
            console.log(`${TABLE}.specialThemeTierIconUrl 新增完成`);
        } else {
            console.log('specialThemeTierIconUrl 欄位已存在，跳過新增');
        }

        const [jsonCol] = await sequelize.query(
            `
            SELECT column_name
            FROM information_schema.columns
            WHERE table_schema = 'public'
              AND table_name = :tableName
              AND column_name = 'specialThemeTierIcons'
            `,
            { replacements: { tableName: TABLE } }
        );

        if (jsonCol.length > 0) {
            await sequelize.query(`
                UPDATE ${TABLE}
                SET "specialThemeTierIconUrl" = COALESCE(
                    NULLIF(TRIM("specialThemeTierIcons"->>'icon'), ''),
                    NULLIF(TRIM("specialThemeTierIcons"->>'all'), ''),
                    NULLIF(TRIM("specialThemeTierIcons"->>'rank1'), ''),
                    NULLIF(TRIM("specialThemeTierIcons"->>'other'), ''),
                    ''
                )
                WHERE "specialThemeTierIconUrl" = ''
                  AND "specialThemeTierIcons" IS NOT NULL
                  AND "specialThemeTierIcons"::text <> '{}'
            `);

            await sequelize.query(`
                ALTER TABLE ${TABLE}
                DROP COLUMN "specialThemeTierIcons"
            `);
            console.log(`${TABLE}.specialThemeTierIcons 已移除並遷移資料`);
        } else {
            console.log('specialThemeTierIcons 欄位不存在，跳過遷移');
        }

        process.exit(0);
    } catch (error) {
        console.error('調整特殊主題榜圖示欄位失敗:', error);
        process.exit(1);
    }
})();
