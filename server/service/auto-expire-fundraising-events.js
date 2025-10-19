const FundraisingEventsStore = require('../store/fundraising-events');
const { ENUM_FUNDRAISING_EVENT_STATUS } = require('../lib/enum');

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
