/**
 * ecpay_config 新增大型募資斗內專用金流開關（與一般斗內 ecpayEnabled 等分離）
 * 執行：node server/migration/addLcfPaymentEnableColumnsToEcpayConfig.js
 */
const sequelize = require('../config/database');

const COLUMNS = [
    {
        name: 'lcfEcpayEnabled',
        sql: 'ADD COLUMN "lcfEcpayEnabled" BOOLEAN NULL DEFAULT true',
    },
    {
        name: 'lcfPayuniEnabled',
        sql: 'ADD COLUMN "lcfPayuniEnabled" BOOLEAN NULL DEFAULT true',
    },
    {
        name: 'lcfOpayEnabled',
        sql: 'ADD COLUMN "lcfOpayEnabled" BOOLEAN NULL DEFAULT true',
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
