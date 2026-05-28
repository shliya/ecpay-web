/**
 * 將 donations.message 改為 TEXT，與 Sequelize 模型一致；避免 DB 仍為短 VARCHAR 時截斷綠界／其他來源的長留言。
 * 執行：node server/migration/expandDonationMessageToText.js
 */
const sequelize = require('../config/database');

(async () => {
    try {
        const [rows] = await sequelize.query(`
            SELECT column_name, data_type, character_maximum_length
            FROM information_schema.columns
            WHERE table_schema = 'public'
              AND table_name = 'donations'
              AND column_name = 'message'
        `);

        if (!rows.length) {
            console.error('donations.message 欄位不存在');
            process.exit(1);
        }

        const col = rows[0];
        console.log(
            `目前 donations.message：data_type=${col.data_type}, character_maximum_length=${col.character_maximum_length}`
        );

        if (col.data_type === 'text') {
            console.log('message 已是 TEXT，無需變更');
            process.exit(0);
        }

        await sequelize.query(`
            ALTER TABLE donations
            ALTER COLUMN message TYPE TEXT
            USING message::text
        `);

        console.log('donations.message 已改為 TEXT');
        process.exit(0);
    } catch (err) {
        console.error('expandDonationMessageToText 失敗:', err);
        process.exit(1);
    }
})();
