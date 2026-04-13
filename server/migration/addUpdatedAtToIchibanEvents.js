const sequelize = require('../config/database');

(async () => {
    try {
        console.log('開始添加 ichiban_events.updated_at 欄位...');

        const [results] = await sequelize.query(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'ichiban_events' 
            AND column_name = 'updated_at'
        `);

        if (results.length > 0) {
            console.log('ichiban_events.updated_at 欄位已存在，跳過添加');
            process.exit(0);
        }

        await sequelize.query(`
            ALTER TABLE ichiban_events 
            ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
        `);

        await sequelize.query(`
            UPDATE ichiban_events 
            SET updated_at = created_at
        `);

        console.log('ichiban_events.updated_at 欄位添加成功');
        process.exit(0);
    } catch (error) {
        console.error('添加 ichiban_events.updated_at 欄位時發生錯誤:', error);
        process.exit(1);
    }
})();
