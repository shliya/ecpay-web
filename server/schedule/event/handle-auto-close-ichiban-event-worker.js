const {
    autoExpireFundraisingEvents,
} = require('../../service/auto-expire-fundraising-events');

async function handleAutoExpireEventsWorker(taskName) {
    try {
        const result = await autoExpireFundraisingEvents();

        if (result.expiredCount > 0) {
            console.log(`[${taskName}] ${result.message}`);
        }
        console.log(`[${taskName}] COMPLETED`);
    } catch (error) {
        console.error(`[${taskName}] FAILED:`, error);
    }
}
module.exports = {
    handleAutoExpireEventsWorker,
};
