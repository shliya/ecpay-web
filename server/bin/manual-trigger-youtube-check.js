const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });
const {
    checkYoutubeLiveStreams,
} = require('../service/check-youtube-live-streams');
const { getActivePollingTasks } = require('../service/youtube-super-chat');

(async function () {
    try {
        console.log('[手動觸發] 開始檢查所有 YouTube 直播...');
        await checkYoutubeLiveStreams();

        const activeTasks = getActivePollingTasks();
        console.log(`[手動觸發] 檢查完成！`);
        console.log(`目前有 ${activeTasks.length} 個活躍的監聽任務:`);

        if (activeTasks.length > 0) {
            activeTasks.forEach(task => {
                console.log(`  ✓ ${task.merchantId} - ${task.channelHandle}`);
            });
        } else {
            console.log('  目前沒有正在監聽的任務');
        }

        process.exit(0);
    } catch (error) {
        console.error('[手動觸發] 錯誤:', error);
        process.exit(1);
    }
})();
