require('dotenv').config();
const {
    autoExpireFundraisingEvents,
} = require('../../service/auto-expire-fundraising-events');
const sequelize = require('../../config/database');

(async () => {
    try {
        console.log(
            `[${new Date().toISOString()}] 開始執行過期募資活動檢查...`
        );

        // 確保資料庫連線
        await sequelize.authenticate();
        console.log('資料庫連線成功！');

        // 執行過期檢查
        const result = await autoExpireFundraisingEvents();

        console.log(`檢查完成: ${result.message}`);

        if (result.success && result.expiredCount > 0) {
            console.log(
                `✅ 成功將 ${result.expiredCount} 個過期募資活動設為 INACTIVE`
            );
        } else if (result.success && result.expiredCount === 0) {
            console.log('✅ 沒有需要更新的過期募資活動');
        } else {
            console.log(`❌ 執行失敗: ${result.message}`);
        }

        process.exit(0);
    } catch (error) {
        console.error('❌ 腳本執行失敗:', error);
        process.exit(1);
    } finally {
        // 關閉資料庫連線
        try {
            await sequelize.close();
            console.log('資料庫連線已關閉');
        } catch (closeError) {
            console.error('關閉資料庫連線時發生錯誤:', closeError);
        }
    }
})();
