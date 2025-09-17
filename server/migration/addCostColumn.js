const sequelize = require('../config/database');

(async () => {
    try {
        console.log('開始添加 cost 欄位...');

        // 檢查欄位是否已存在
        const [results] = await sequelize.query(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'fundraising_events' 
            AND column_name = 'cost'
        `);

        if (results.length > 0) {
            console.log('cost 欄位已存在，跳過添加');
            process.exit(0);
        }

        // 添加 type 欄位
        await sequelize.query(`
            ALTER TABLE fundraising_events 
            ADD COLUMN cost INTEGER NOT NULL DEFAULT 0
        `);

        console.log('cost 欄位添加成功！');

        // 可選：為現有記錄設定預設值
        await sequelize.query(`
            UPDATE fundraising_events 
            SET cost = 0 
            WHERE cost IS NULL
        `);

        console.log('現有記錄已更新預設 cost 值');
        process.exit(0);
    } catch (error) {
        console.error('添加 cost 欄位時發生錯誤:', error);
        process.exit(1);
    }
})();
