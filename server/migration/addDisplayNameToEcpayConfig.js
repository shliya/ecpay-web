/**
 * 新增 ecpay_config.displayName 欄位（用於觀眾斗內網址 ?name=${vtubername}）。
 * 執行：node server/migration/addDisplayNameToEcpayConfig.js
 */
const sequelize = require('../config/database');

(async () => {
    try {
        console.log('開始添加 displayName 欄位到 ecpay_config...');

        const [results] = await sequelize.query(`
            SELECT column_name
            FROM information_schema.columns
            WHERE table_schema = 'public'
              AND table_name = 'ecpay_config'
              AND (column_name = 'displayName' OR column_name = 'displayname')
        `);

        const existing = results.length > 0;

        if (!existing) {
            await sequelize.query(`
                ALTER TABLE ecpay_config
                ADD COLUMN "displayName" VARCHAR(100) NULL UNIQUE
            `);
            console.log('displayName 欄位添加成功！');
        } else {
            console.log('displayName 欄位已存在，跳過添加');
        }

        process.exit(0);
    } catch (error) {
        console.error('添加 displayName 欄位時發生錯誤:', error);
        process.exit(1);
    }
})();
