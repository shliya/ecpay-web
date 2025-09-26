const { handleAutoExpireEventsWorker } = require('../schedule/event');

class TaskScheduler {
    constructor() {
        this.intervals = new Map();
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
            // 60 * 60 * 1000 // 1小時
            1000 // 1秒
        );
        handleAutoExpireEventsWorker;
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

        const intervalId = setInterval(async () => {
            try {
                await taskFunction(taskName);
            } catch (error) {
                console.error(`任務 ${taskName} 執行失敗:`, error);
            }
        }, intervalMs);

        this.intervals.set(taskName, intervalId);
        console.log(`已排程任務: ${taskName}，執行間隔: ${intervalMs}ms`);
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
