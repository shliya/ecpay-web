require('dotenv').config();

const {
    reconcileFundraisingEventCosts,
} = require('../service/reconcile-fundraising-event-cost');

(async () => {
    const argv = process.argv.slice(2);
    const dryRun = argv.includes('--dry-run');
    const verbose = argv.includes('--verbose') || argv.includes('-v');

    console.log('[run-fundraising-cost-reconcile] 開始');

    try {
        const result = await reconcileFundraisingEventCosts({
            dryRun,
            verbose,
        });
        console.log('[run-fundraising-cost-reconcile] 完成', result);
        process.exit(0);
    } catch (err) {
        console.error('[run-fundraising-cost-reconcile]', err);
        process.exit(1);
    }
})();
