const {
    autoExpireFundraisingEvents,
} = require('../../service/auto-expire-fundraising-events');

/**
 * 手動觸發過期募資活動檢查
 */
module.exports = async (req, res) => {
    try {
        console.log(`[${new Date().toISOString()}] API 手動觸發過期檢查`);

        const result = await autoExpireFundraisingEvents();

        if (result.success) {
            res.status(200).json({
                success: true,
                message: result.message,
                expiredCount: result.expiredCount,
                timestamp: new Date().toISOString(),
            });
        } else {
            res.status(500).json({
                success: false,
                message: result.message,
                expiredCount: 0,
                timestamp: new Date().toISOString(),
            });
        }
    } catch (error) {
        console.error('API 過期檢查失敗:', error);
        res.status(500).json({
            success: false,
            message: `過期檢查失敗: ${error.message}`,
            expiredCount: 0,
            timestamp: new Date().toISOString(),
        });
    }
};
