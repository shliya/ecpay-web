/**
 * 新增 ecpay_config.theme_colors（觀眾斗內頁自訂色塊，JSON）。
 * 執行：node server/migration/addThemeColorsToEcpayConfig.js
 */
const sequelize = require('../config/database');

(async () => {
    try {
        const [cols] = await sequelize.query(`
            SELECT column_name FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = 'ecpay_config'
            AND (column_name = 'themeColors' OR column_name = 'theme_colors' OR column_name = 'themecolors')
        `);
        if (cols.length > 0) {
            console.log('theme_colors 欄位已存在，跳過');
            process.exit(0);
            return;
        }
        await sequelize.query(`
            ALTER TABLE ecpay_config
            ADD COLUMN "themeColors" JSONB NULL
        `);
        console.log('themeColors 欄位添加成功');
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
})();
