const {
    handleAutoExpireEventsWorker,
    handlePaymentTimeoutWorker,
    handleReconcileFundraisingEventCostWorker,
} = require('../schedule/event');
const { handleYoutubeSuperChatWorker } = require('../schedule/youtube');

const RUNNING_TASKS = new Set();

/** 到「本機曆法的下一個」00:00:00.000 的毫秒數（含跨日 DST 由引擎處理） */
function msUntilNextLocalMidnight() {
    const nextMidnight = new Date(
        new Date().getFullYear(),
        new Date().getMonth(),
        new Date().getDate() + 1,
        0,
        0,
        0,
        0
    ).getTime();
    const ms = nextMidnight - Date.now();
    return ms > 0 ? ms : 24 * 60 * 60 * 1000;
}

function wrapWithTaskLock(taskName, taskFunction) {
    return async function wrappedTask() {
        if (RUNNING_TASKS.has(taskName)) {
            console.log(`[${taskName}] 上次執行尚未完成，跳過本次排程`);
            return;
        }
        RUNNING_TASKS.add(taskName);
        try {
            await taskFunction(taskName);
        } finally {
            RUNNING_TASKS.delete(taskName);
        }
    };
}

class TaskScheduler {
    constructor() {
        this.intervals = new Map();
        /** @type {Map<string, () => void>} 取消 chained setTimeout */
        this.dailyTimersCancel = new Map();
        this.isRunning = false;
    }

    /**
     * 啟動定時任務排程器
     */
    start() {
        if (this.isRunning) {
            console.log('任務排程器已在運行中');
            return;
        }

        this.isRunning = true;
        console.log(`[${new Date().toISOString()}] 任務排程器已啟動`);

        this.scheduleTask(
            'auto-expire-events',
            handleAutoExpireEventsWorker,
            60 * 60 * 1000 // 1小時
            // 1000 // 1秒
        );

        this.scheduleTask(
            'payment-timeout',
            handlePaymentTimeoutWorker,
            60 * 1000 // 1分鐘
        );

        this.scheduleTask(
            'youtube-super-chat',
            handleYoutubeSuperChatWorker,
            1 * 60 * 1000 // 1分鐘檢查一次是否有新直播（降低 API 使用量）
        );

        // 對齊活動 cost 與「活動期間斗內」加總（依起迄 UTC 日期，與查看斗內一致）
        if (
            process.env.DISABLE_FUNDRAISING_COST_RECONCILE === 'true' ||
            process.env.DISABLE_FUNDRAISING_COST_RECONCILE === '1'
        ) {
            console.log(
                '已停用 reconcile-fundraising-event-cost（DISABLE_FUNDRAISING_COST_RECONCILE）'
            );
        } else {
            this.scheduleTaskDailyAroundLocalMidnight(
                'reconcile-fundraising-event-cost',
                handleReconcileFundraisingEventCostWorker
            );
        }
    }

    /**
     * 停止定時任務排程器
     */
    stop() {
        if (!this.isRunning) {
            console.log('任務排程器未在運行');
            return;
        }

        this.intervals.forEach((intervalId, taskName) => {
            clearInterval(intervalId);
            console.log(`已停止任務: ${taskName}`);
        });

        this.intervals.clear();

        this.dailyTimersCancel.forEach((_cancelFn, taskName) => {
            console.log(`已停止任務（每日）: ${taskName}`);
        });
        this.dailyTimersCancel.forEach(cancelFn => cancelFn());
        this.dailyTimersCancel.clear();

        this.isRunning = false;
        console.log(`[${new Date().toISOString()}] 任務排程器已停止`);
    }

    /**
     * 排程單個任務
     * @param {string} taskName 任務名稱
     * @param {Function} taskFunction 任務函式
     * @param {number} intervalMs 執行間隔（毫秒）
     */
    scheduleTask(taskName, taskFunction, intervalMs) {
        if (this.intervals.has(taskName)) {
            console.log(`任務 ${taskName} 已存在，跳過排程`);
            return;
        }

        const wrappedTask = wrapWithTaskLock(taskName, taskFunction);
        const intervalId = setInterval(async () => {
            try {
                await wrappedTask();
            } catch (error) {
                console.error(`任務 ${taskName} 執行失敗:`, error);
            }
        }, intervalMs);

        this.intervals.set(taskName, intervalId);
        console.log(`已排程任務: ${taskName}，執行間隔: ${intervalMs}ms`);
    }

    /**
     * 約每天本機時間 00:00 執行一次（啟動時若過了 0 點則等至隔日）
     * @param {string} taskName
     * @param {Function} taskFunction
     */
    scheduleTaskDailyAroundLocalMidnight(taskName, taskFunction) {
        if (
            this.intervals.has(taskName) ||
            this.dailyTimersCancel.has(taskName)
        ) {
            console.log(`任務 ${taskName} 已存在，跳過排程`);
            return;
        }

        const wrappedTask = wrapWithTaskLock(taskName, taskFunction);

        /** @type {ReturnType<typeof setTimeout>|null} */
        let pending = null;

        const cancel = () => {
            if (pending != null) {
                clearTimeout(pending);
                pending = null;
            }
        };

        const scheduleNext = () => {
            cancel();
            const delay = msUntilNextLocalMidnight();
            pending = setTimeout(async () => {
                try {
                    await wrappedTask();
                } catch (error) {
                    console.error(`任務 ${taskName} 執行失敗:`, error);
                } finally {
                    scheduleNext();
                }
            }, delay);
            const nextRun = new Date(Date.now() + delay);
            console.log(
                `已排程任務: ${taskName}，每日約 0 點一次；下次約 ${nextRun.toString()}（約 ${Math.round(delay / 1000 / 60)} 分鐘後）`
            );
        };

        this.dailyTimersCancel.set(taskName, cancel);

        scheduleNext();
    }

    /**
     * 獲取排程器狀態
     */
    getStatus() {
        return {
            isRunning: this.isRunning,
            activeTasks: Array.from(this.intervals.keys()),
            taskCount: this.intervals.size,
        };
    }
}

// 建立單例實例
const scheduler = new TaskScheduler();

module.exports = {
    scheduler,
    TaskScheduler,
};
