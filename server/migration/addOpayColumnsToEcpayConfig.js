/**
 * 新增 ecpay_config 歐付寶欄位。
 * 執行：node server/migration/addOpayColumnsToEcpayConfig.js
 */
const sequelize = require('../config/database');

const COLUMNS = [
    {
        name: 'opayMerchantId',
        sql: 'ADD COLUMN "opayMerchantId" VARCHAR(100) UNIQUE',
    },
    {
        name: 'opayHashKey',
        sql: 'ADD COLUMN "opayHashKey" VARCHAR(100) NULL',
    },
    {
        name: 'opayHashIV',
        sql: 'ADD COLUMN "opayHashIV" VARCHAR(100) NULL',
    },
    {
        name: 'opayEnabled',
        sql: 'ADD COLUMN "opayEnabled" BOOLEAN NULL DEFAULT true',
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
