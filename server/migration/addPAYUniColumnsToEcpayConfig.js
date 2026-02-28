const sequelize = require('../config/database');

(async () => {
    try {
        console.log('開始添加 PAYUNi 相關欄位到 ecpay_config...');

        const [results] = await sequelize.query(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_schema = 'public'
            AND table_name = 'ecpay_config' 
            AND LOWER(column_name) IN ('payunimerchantid', 'payunihashkey', 'payunihashiv')
        `);

        const existingColumns = results.map(r =>
            String(r.column_name || '').toLowerCase()
        );

        if (!existingColumns.includes('payunimerchantid')) {
            await sequelize.query(`
                ALTER TABLE ecpay_config 
                ADD COLUMN "payuniMerchantId" VARCHAR(50) NULL
            `);
            console.log('payuniMerchantId 欄位添加成功！');
        } else {
            console.log('payuniMerchantId 欄位已存在，跳過添加');
        }

        if (!existingColumns.includes('payunihashkey')) {
            await sequelize.query(`
                ALTER TABLE ecpay_config 
                ADD COLUMN "payuniHashKey" VARCHAR(100) NULL
            `);
            console.log('payuniHashKey 欄位添加成功！');
        } else {
            console.log('payuniHashKey 欄位已存在，跳過添加');
        }

        if (!existingColumns.includes('payunihashiv')) {
            await sequelize.query(`
                ALTER TABLE ecpay_config 
                ADD COLUMN "payuniHashIV" VARCHAR(100) NULL
            `);
            console.log('payuniHashIV 欄位添加成功！');
        } else {
            console.log('payuniHashIV 欄位已存在，跳過添加');
        }

        process.exit(0);
    } catch (error) {
        console.error('添加 PAYUNi 欄位時發生錯誤:', error);
        process.exit(1);
    }
})();
