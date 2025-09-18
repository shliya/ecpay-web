const FundraisingEventsStore = require('../store/fundraising-events');
const { ENUM_FUNDRAISING_EVENT_STATUS } = require('../lib/enum');

/**
 * 自動將過期的募資活動狀態設為 INACTIVE
 * @returns {Promise<{success: boolean, expiredCount: number, message: string}>}
 */
async function autoExpireFundraisingEvents() {
    const result = {
        success: false,
        expiredCount: 0,
        message: '',
    };

    try {
        const expiredCount =
            await FundraisingEventsStore.expireOutdatedEvents();

        result.success = true;
        result.expiredCount = expiredCount;
        result.message = `成功將 ${expiredCount} 個過期募資活動設為 INACTIVE`;

        if (expiredCount > 0) {
            console.log(`[${new Date().toISOString()}] ${result.message}`);
        }

        return result;
    } catch (error) {
        result.message = `自動過期處理失敗: ${error.message}`;
        console.error(`[${new Date().toISOString()}] ${result.message}`, error);
        throw error;
    }
}

module.exports = {
    autoExpireFundraisingEvents,
};
