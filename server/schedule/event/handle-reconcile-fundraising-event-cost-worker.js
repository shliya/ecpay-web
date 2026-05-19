const {
    reconcileFundraisingEventCosts,
} = require('../../service/reconcile-fundraising-event-cost');

async function handleReconcileFundraisingEventCostWorker(taskName) {
    try {
        const { scanned, corrected, skipped } =
            await reconcileFundraisingEventCosts();
        if (corrected > 0) {
            console.log(
                `[${taskName}] 掃描 ${scanned} 筆，已對齊 cost ${corrected} 筆，略過 ${skipped} 筆`
            );
        }
        console.log(`[${taskName}] COMPLETED`);
    } catch (error) {
        console.error(`[${taskName}] FAILED:`, error);
    }
}

module.exports = {
    handleReconcileFundraisingEventCostWorker,
};
