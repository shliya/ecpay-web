const sequelize = require('../config/database');

(async () => {
    try {
        console.log('開始添加 YouTube 相關欄位到 ecpay_config...');

        const [results] = await sequelize.query(`
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_name = 'ecpay_config' 
            AND column_name IN ('youtubechannelhandle', 'youtubechannelid')
        `);

        const existingColumns = results.map(r => r.column_name);

        if (!existingColumns.includes('youtubechannelhandle')) {
            await sequelize.query(`
                ALTER TABLE ecpay_config 
                ADD COLUMN "youtubeChannelHandle" VARCHAR(100) NULL
            `);
            console.log('youtubeChannelHandle 欄位添加成功！');
        } else {
            console.log('youtubeChannelHandle 欄位已存在，跳過添加');
        }

        if (!existingColumns.includes('youtubechannelid')) {
            await sequelize.query(`
                ALTER TABLE ecpay_config 
                ADD COLUMN "youtubeChannelId" VARCHAR(100) NULL
            `);
            console.log('youtubeChannelId 欄位添加成功！');
        } else {
            console.log('youtubeChannelId 欄位已存在，跳過添加');
        }

        process.exit(0);
    } catch (error) {
        console.error('添加 YouTube 欄位時發生錯誤:', error);
        process.exit(1);
    }
})();
