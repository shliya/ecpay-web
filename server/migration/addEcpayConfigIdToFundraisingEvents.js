const sequelize = require('../config/database');

(async () => {
    try {
        console.log(
            '開始添加 fundraising_events.ecpayConfigId 欄位並建立外鍵...'
        );

        const [colResults] = await sequelize.query(`
            SELECT column_name
            FROM information_schema.columns
            WHERE table_schema = 'public'
            AND table_name = 'fundraising_events'
            AND LOWER(column_name) = 'ecpayconfigid'
        `);

        if (colResults.length > 0) {
            console.log('ecpayConfigId 欄位已存在，跳過添加');
            process.exit(0);
        }

        await sequelize.query(`
            ALTER TABLE fundraising_events
            ADD COLUMN "ecpayConfigId" BIGINT NULL
        `);
        console.log('fundraising_events.ecpayConfigId 欄位添加成功');

        await sequelize.query(`
            UPDATE fundraising_events fe
            SET "ecpayConfigId" = e.id
            FROM ecpay_config e
            WHERE e."merchantId" = fe."merchantId"
            AND fe."ecpayConfigId" IS NULL
        `);
        console.log('已依 merchantId 回填 ecpayConfigId');

        const [constraintResults] = await sequelize.query(`
            SELECT constraint_name
            FROM information_schema.table_constraints
            WHERE table_schema = 'public'
            AND table_name = 'fundraising_events'
            AND constraint_type = 'FOREIGN KEY'
            AND constraint_name = 'fk_fundraising_events_ecpay_config'
        `);

        if (constraintResults.length === 0) {
            await sequelize.query(`
                ALTER TABLE fundraising_events
                ADD CONSTRAINT fk_fundraising_events_ecpay_config
                FOREIGN KEY ("ecpayConfigId") REFERENCES ecpay_config(id)
            `);
            console.log('外鍵 fk_fundraising_events_ecpay_config 建立成功');
        } else {
            console.log('外鍵已存在，跳過');
        }

        process.exit(0);
    } catch (error) {
        console.error('migration 執行錯誤:', error);
        process.exit(1);
    }
})();
