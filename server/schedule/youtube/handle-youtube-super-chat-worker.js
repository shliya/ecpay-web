const {
    checkYoutubeLiveStreams,
} = require('../../service/check-youtube-live-streams');

async function handleYoutubeSuperChatWorker(taskName) {
    try {
        await checkYoutubeLiveStreams();
        console.log(`[${taskName}] COMPLETED`);
    } catch (error) {
        console.error(`[${taskName}] FAILED:`, error);
    }
}

module.exports = {
    handleYoutubeSuperChatWorker,
};
