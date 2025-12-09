const sequelize = require('../config/database');
const { ENUM_DONATION_TYPE } = require('../lib/enum');

(async () => {
    try {
        console.log('開始添加 donations.type 欄位...');

        const [results] = await sequelize.query(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'donations' 
            AND column_name = 'type'
        `);

        if (results.length > 0) {
            console.log('type 欄位已存在，跳過添加');
            process.exit(0);
        }

        await sequelize.query(`
            ALTER TABLE donations 
            ADD COLUMN type INTEGER NOT NULL DEFAULT ${ENUM_DONATION_TYPE.ECPAY}
        `);

        console.log('donations.type 欄位添加成功！');

        await sequelize.query(`
            UPDATE donations 
            SET type = ${ENUM_DONATION_TYPE.ECPAY} 
            WHERE type IS NULL
        `);

        console.log('現有記錄已更新預設 type 值');
        process.exit(0);
    } catch (error) {
        console.error('添加 type 欄位時發生錯誤:', error);
        process.exit(1);
    }
})();
