const sequelize = require('../config/database');

(async () => {
    try {
        console.log('開始為 merchantId 欄位添加 unique 索引...');

        // 檢查索引是否已存在
        const [results] = await sequelize.query(`
            SELECT indexname 
            FROM pg_indexes 
            WHERE tablename = 'ecpay_config' 
            AND indexdef LIKE '%merchantId%' 
            AND indexdef LIKE '%UNIQUE%'
        `);

        if (results.length > 0) {
            console.log('merchantId unique 索引已存在，跳過添加');
            process.exit(0);
        }

        // 檢查是否有重複的 merchantId 值
        const [duplicates] = await sequelize.query(`
            SELECT "merchantId", COUNT(*) as count 
            FROM ecpay_config 
            GROUP BY "merchantId" 
            HAVING COUNT(*) > 1
        `);

        if (duplicates.length > 0) {
            console.error('發現重複的 merchantId 值，無法添加 unique 索引:');
            duplicates.forEach(dup => {
                console.error(
                    `merchantId: ${dup.merchantId}, 重複次數: ${dup.count}`
                );
            });
            console.error('請先清理重複資料後再執行此 migration');
            process.exit(1);
        }

        // 添加 unique 索引
        await sequelize.query(`
            ALTER TABLE ecpay_config 
            ADD CONSTRAINT uk_ecpay_config_merchantId 
            UNIQUE ("merchantId")
        `);

        console.log('merchantId unique 索引添加成功！');
        process.exit(0);
    } catch (error) {
        console.error('添加 merchantId unique 索引時發生錯誤:', error);
        process.exit(1);
    }
})();
