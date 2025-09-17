const sequelize = require('../config/database');
const { ENUM_FUNDRAISING_EVENT_TYPE } = require('../lib/enum');

(async () => {
    try {
        console.log('開始添加 type 欄位...');

        // 檢查欄位是否已存在
        const [results] = await sequelize.query(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'fundraising_events' 
            AND column_name = 'type'
        `);

        if (results.length > 0) {
            console.log('type 欄位已存在，跳過添加');
            process.exit(0);
        }

        // 添加 type 欄位
        await sequelize.query(`
            ALTER TABLE fundraising_events 
            ADD COLUMN type INTEGER NOT NULL DEFAULT ${ENUM_FUNDRAISING_EVENT_TYPE.UP}
        `);

        console.log('type 欄位添加成功！');

        // 可選：為現有記錄設定預設值
        await sequelize.query(`
            UPDATE fundraising_events 
            SET type = ${ENUM_FUNDRAISING_EVENT_TYPE.UP} 
            WHERE type IS NULL
        `);

        console.log('現有記錄已更新預設 type 值');
        process.exit(0);
    } catch (error) {
        console.error('添加 type 欄位時發生錯誤:', error);
        process.exit(1);
    }
})();
