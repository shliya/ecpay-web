const {
    autoExpireFundraisingEvents,
} = require('../service/auto-expire-fundraising-events');

(async () => {
    try {
        await autoExpireFundraisingEvents();
        console.log('手動過期檢查完成');
    } catch (error) {
        console.error('過期檢查失敗:', error);
    }
})();
