/**
 * ecpay_config 新增 largeCrowdfundingEnabled（大型募資功能開關，預設關閉）
 *
 * 手動啟用：UPDATE ecpay_config SET "largeCrowdfundingEnabled" = true WHERE "merchantId" = '...';
 *
 * 執行：node server/migration/addLargeCrowdfundingEnabledToEcpayConfig.js
 */
const sequelize = require('../config/database');

const TABLE = 'ecpay_config';
const COLUMN = 'largeCrowdfundingEnabled';

(async () => {
    try {
        const [cols] = await sequelize.query(
            `
            SELECT column_name
            FROM information_schema.columns
            WHERE table_schema = 'public'
              AND table_name = :tableName
              AND column_name = :columnName
            `,
            { replacements: { tableName: TABLE, columnName: COLUMN } }
        );

        if (cols.length > 0) {
            console.log(`${COLUMN} 欄位已存在，跳過`);
            process.exit(0);
        }

        await sequelize.query(`
            ALTER TABLE ${TABLE}
            ADD COLUMN "${COLUMN}" BOOLEAN NULL DEFAULT false
        `);

        console.log(`${TABLE}.${COLUMN} 新增完成（預設 false）`);
        process.exit(0);
    } catch (error) {
        console.error(`新增 ${COLUMN} 失敗:`, error);
        process.exit(1);
    }
})();
