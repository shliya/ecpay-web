const sequelize = require('../config/database');

(async () => {
    try {
        console.log('開始添加 donations.ecpayConfigId 欄位並建立外鍵...');

        const [colResults] = await sequelize.query(`
            SELECT column_name
            FROM information_schema.columns
            WHERE table_schema = 'public'
            AND table_name = 'donations'
            AND LOWER(column_name) = 'ecpayconfigid'
        `);

        if (colResults.length > 0) {
            console.log('ecpayConfigId 欄位已存在，跳過添加');
            process.exit(0);
        }

        await sequelize.query(`
            ALTER TABLE donations
            ADD COLUMN "ecpayConfigId" BIGINT NULL
        `);
        console.log('donations.ecpayConfigId 欄位添加成功');

        const [updateResult] = await sequelize.query(`
            UPDATE donations d
            SET "ecpayConfigId" = e.id
            FROM ecpay_config e
            WHERE e."merchantId" = d."merchantId"
            AND d."ecpayConfigId" IS NULL
        `);
        console.log('已依 merchantId 回填 ecpayConfigId');

        const [constraintResults] = await sequelize.query(`
            SELECT constraint_name
            FROM information_schema.table_constraints
            WHERE table_schema = 'public'
            AND table_name = 'donations'
            AND constraint_type = 'FOREIGN KEY'
            AND constraint_name = 'fk_donations_ecpay_config'
        `);

        if (constraintResults.length === 0) {
            await sequelize.query(`
                ALTER TABLE donations
                ADD CONSTRAINT fk_donations_ecpay_config
                FOREIGN KEY ("ecpayConfigId") REFERENCES ecpay_config(id)
            `);
            console.log('外鍵 fk_donations_ecpay_config 建立成功');
        } else {
            console.log('外鍵已存在，跳過');
        }

        process.exit(0);
    } catch (error) {
        console.error('migration 執行錯誤:', error);
        process.exit(1);
    }
})();
