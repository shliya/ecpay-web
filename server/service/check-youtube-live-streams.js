const { getAllEcpayConfigs } = require('../store/ecpay-config');
const {
    startPollingSuperChat,
    stopPollingSuperChat,
    getActivePollingTasks,
} = require('./youtube-super-chat');
const {
    getChannelLiveStreamByChannelId,
    getChannelIdByUserHandel,
} = require('../lib/youtubeApi');

async function checkYoutubeLiveStreams() {
    try {
        const configs = await getAllEcpayConfigs();
        const activeTasks = getActivePollingTasks();
        const activeMerchantIds = new Set(activeTasks.map(t => t.merchantId));
        const processedMerchantIds = new Set();

        for (const config of configs) {
            const { merchantId, youtubeChannelHandle, youtubeChannelId } =
                config;

            if (processedMerchantIds.has(merchantId)) {
                continue;
            }

            processedMerchantIds.add(merchantId);

            const hasValidHandle =
                youtubeChannelHandle &&
                youtubeChannelHandle.trim() !== '';

            if (!hasValidHandle && !youtubeChannelId) {
                if (activeMerchantIds.has(merchantId)) {
                    stopPollingSuperChat(merchantId);
                }
                continue;
            }

            try {
                let channelId = youtubeChannelId;

                if (!channelId && hasValidHandle) {
                    channelId =
                        await getChannelIdByUserHandel(youtubeChannelHandle);
                }

                if (!channelId) {
                    if (activeMerchantIds.has(merchantId)) {
                        stopPollingSuperChat(merchantId);
                    }
                    continue;
                }

                const liveStream =
                    await getChannelLiveStreamByChannelId(channelId);

                if (liveStream) {
                    if (!activeMerchantIds.has(merchantId)) {
                        await startPollingSuperChat(merchantId, config);
                    }
                } else {
                    if (activeMerchantIds.has(merchantId)) {
                        stopPollingSuperChat(merchantId);
                    }
                }
            } catch (error) {
                console.error(
                    `[Check Live Streams] ${merchantId} 檢查錯誤:`,
                    error.message
                );
            }
        }
    } catch (error) {
        console.error('[Check Live Streams] 檢查所有直播時發生錯誤:', error);
        throw error;
    }
}

module.exports = {
    checkYoutubeLiveStreams,
};
