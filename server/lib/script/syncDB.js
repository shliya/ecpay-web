const FundraisingEventsModel = require('../../model/fundraising-events');

(async () => {
    try {
        await FundraisingEventsModel.sequelize.sync();
    } catch (error) {
        console.error('同步資料庫時發生錯誤:', error);
    }
})();
