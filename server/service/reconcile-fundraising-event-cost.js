/**
 * 依活動起迄日期（與前台「查看斗內」相同之 YYYY-MM-DD UTC）重算並寫回 cost。
 */

const FundraisingEvents = require('../model/fundraising-events');
const DonationStore = require('../store/donation');
const { resolveEcpayConfigId } = require('../store/fundraising-events');

/** 與 app/event-list.js `toDateOnlyParam`：活動時間轉 UTC 日期字串 */
function fundraisingDateToUtcDateOnly(value) {
    if (value == null || value === '') {
        return '';
    }
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) {
        return '';
    }
    return d.toISOString().slice(0, 10);
}

/**
 * @param {object} [options]
 * @param {boolean} [options.dryRun] 只統計不落庫
 * @param {boolean} [options.verbose] 詳細紀錄
 * @returns {Promise<{ scanned: number, corrected: number, skipped: number }>}
 */
async function reconcileFundraisingEventCosts(options = {}) {
    const dryRun = Boolean(options.dryRun);
    const verbose = Boolean(options.verbose);

    const events = await FundraisingEvents.findAll({
        order: [['id', 'ASC']],
    });

    let scanned = 0;
    let corrected = 0;
    let skipped = 0;

    for (const row of events) {
        scanned += 1;
        let ecpayConfigId =
            row.ecpayConfigId != null
                ? row.ecpayConfigId
                : await resolveEcpayConfigId(row.merchantId);

        if (ecpayConfigId == null) {
            skipped += 1;
            if (verbose) {
                console.warn(
                    `[reconcile-fundraising-event-cost] 略過事件 id=${row.id}（無法解析 ecpayConfigId）`
                );
            }
            continue;
        }

        const startStr = fundraisingDateToUtcDateOnly(row.startMonth);
        const endStr = fundraisingDateToUtcDateOnly(row.endMonth);
        if (!startStr || !endStr) {
            skipped += 1;
            if (verbose) {
                console.warn(
                    `[reconcile-fundraising-event-cost] 略過事件 id=${row.id}（日期無效）`
                );
            }
            continue;
        }

        const expected =
            await DonationStore.sumDonationCostByEcpayConfigIdAndDateRange(
                ecpayConfigId,
                startStr,
                endStr
            );

        const stored = Number(row.cost) || 0;
        if (expected === stored) {
            continue;
        }

        corrected += 1;

        console.log(
            `[reconcile-fundraising-event-cost] 校正 id=${row.id} name="${row.eventName}" cost ${stored} → ${expected}` +
                `（期間 ${startStr} ~ ${endStr}）`
        );

        if (!dryRun) {
            await FundraisingEvents.update(
                {
                    cost: expected,
                    updated_at: new Date(),
                },
                { where: { id: row.id } }
            );
        }
    }

    if (corrected === 0 && verbose) {
        console.log('[reconcile-fundraising-event-cost] 無需校正');
    }

    return { scanned, corrected, skipped };
}

module.exports = {
    reconcileFundraisingEventCosts,
    fundraisingDateToUtcDateOnly,
};
