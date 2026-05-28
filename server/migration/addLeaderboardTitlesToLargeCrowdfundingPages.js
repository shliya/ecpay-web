/**
 * large_crowdfunding_pages 新增榜單標題欄位（文字或圖片網址）
 *
 * 執行：node server/migration/addLeaderboardTitlesToLargeCrowdfundingPages.js
 */
const sequelize = require('../config/database');

const TABLE = 'large_crowdfunding_pages';

const COLUMNS = [
    { name: 'mainDonorListTitle', sql: 'TEXT NOT NULL DEFAULT \'\'' },
    {
        name: 'specialThemeRankingTitle',
        sql: 'TEXT NOT NULL DEFAULT \'\'',
    },
];

(async () => {
    try {
        for (const col of COLUMNS) {
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
                        columnName: col.name,
                    },
                }
            );

            if (rows.length > 0) {
                console.log(`${col.name} 欄位已存在，跳過`);
                continue;
            }

            await sequelize.query(`
            ALTER TABLE ${TABLE}
            ADD COLUMN "${col.name}" ${col.sql}
        `);
            console.log(`${TABLE}.${col.name} 新增完成`);
        }
        process.exit(0);
    } catch (error) {
        console.error('新增榜單標題欄位失敗:', error);
        process.exit(1);
    }
})();
