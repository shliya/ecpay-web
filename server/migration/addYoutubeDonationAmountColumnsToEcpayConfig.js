/**
 * 新增 ecpay_config youtubeDonationEnabled 和 youtubeDonationAmount 啟用欄位。
 * 執行：node server/migration/addYoutubeDonationAmountColumnsToEcpayConfig.js
 */
const sequelize = require('../config/database');

const COLUMNS = [
    {
        name: 'youtubeDonationEnabled',
        sql: 'ADD COLUMN "youtubeDonationEnabled" BOOLEAN NULL DEFAULT false',
    },
    {
        name: 'youtubeDonationAmount',
        sql: 'ADD COLUMN "youtubeDonationAmount" INTEGER NULL DEFAULT 50',
    },
];

(async () => {
    try {
        const [existing] = await sequelize.query(`
            SELECT column_name FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = 'ecpay_config'
        `);
        const existingNames = existing.map(r => r.column_name);

        for (const col of COLUMNS) {
            if (existingNames.includes(col.name)) {
                console.log(`${col.name} 欄位已存在，跳過`);
                continue;
            }
            await sequelize.query(`
                ALTER TABLE ecpay_config ${col.sql}
            `);
            console.log(`${col.name} 欄位添加成功`);
        }
        process.exit(0);
    } catch (err) {
        console.error(err);
        process.exit(1);
    }
})();
