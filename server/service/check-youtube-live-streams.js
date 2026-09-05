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

const CHECK_CACHE = new Map();
const ACTIVE_MERCHANTS = new Map();
const ACTIVE_TIMEOUT = 5 * 60 * 1000; // 5分鐘無回應視為不活躍

// 偵測直播已不吃 search 配額（RSS + 1~2 quota），可以查得更密、開台反應更快
const CACHE_DURATION_WITHOUT_LIVE = 60 * 1000; // 1分鐘檢查一次

function isMerchantActive(merchantId) {
    if (process.env.NODE_ENV === 'development') {
        return true;
    }
    const lastActive = ACTIVE_MERCHANTS.get(merchantId);
    if (!lastActive) return false;
    return Date.now() - lastActive < ACTIVE_TIMEOUT;
}

function shouldSkipCheck(merchantId) {
    const cached = CHECK_CACHE.get(merchantId);

    if (!cached) {
        return false;
    }

    return Date.now() - cached.lastCheckTime < CACHE_DURATION_WITHOUT_LIVE;
}

function updateCache(merchantId, hasLiveStream) {
    CHECK_CACHE.set(merchantId, {
        lastCheckTime: Date.now(),
        hasLiveStream,
    });
}

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

            if (
                !isMerchantActive(merchantId) &&
                !activeMerchantIds.has(merchantId)
            ) {
                continue;
            }

            console.log(`[Check Live Streams] 用戶:${merchantId} 活躍中`);

            const hasValidHandle =
                youtubeChannelHandle && youtubeChannelHandle.trim() !== '';

            if (!hasValidHandle && !youtubeChannelId) {
                console.log(
                    `[Check Live Streams] ${merchantId} 無有效頻道資訊`
                );
                if (activeMerchantIds.has(merchantId)) {
                    stopPollingSuperChat(merchantId);
                }
                continue;
            }

            try {
                // 已在輪詢聊天室的商家完全不用再偵測直播：
                // 直播結束時 liveChatMessages 會回 liveChatEnded，輪詢自己會收尾。
                if (activeMerchantIds.has(merchantId)) {
                    console.log(
                        `[Check Live Streams] ${merchantId} 輪詢中，略過直播偵測`
                    );
                    continue;
                }

                if (shouldSkipCheck(merchantId)) {
                    console.log(
                        `[Check Live Streams] ${merchantId} 快取有效，跳過檢查`
                    );
                    continue;
                }

                let channelId = youtubeChannelId;

                if (!channelId && hasValidHandle) {
                    channelId =
                        await getChannelIdByUserHandel(youtubeChannelHandle);
                }

                if (!channelId) {
                    console.log(
                        `[Check Live Streams] ${merchantId} 無法取得 Channel ID`
                    );
                    if (activeMerchantIds.has(merchantId)) {
                        stopPollingSuperChat(merchantId);
                    }
                    updateCache(merchantId, false);
                    continue;
                }

                const liveStream =
                    await getChannelLiveStreamByChannelId(channelId);

                if (liveStream) {
                    console.log(
                        `[Check Live Streams] ${merchantId} 發現直播: ${liveStream.newLiveStreamTitle}`
                    );
                    updateCache(merchantId, true);
                    console.log(`[Check Live Streams] ${merchantId} 開始輪詢`);
                    // 把已查到的直播資訊帶下去，避免 startPolling 內再查一次
                    await startPollingSuperChat(merchantId, config, {
                        channelId,
                        liveStream,
                    });
                } else {
                    console.log(
                        `[Check Live Streams] ${merchantId} 未發現直播`
                    );
                    updateCache(merchantId, false);
                    if (activeMerchantIds.has(merchantId)) {
                        stopPollingSuperChat(merchantId);
                    }
                }
            } catch (error) {
                console.error(
                    `[Check Live Streams] ${merchantId} 檢查錯誤:`,
                    error.message
                );
                updateCache(merchantId, false);
            }
        }
    } catch (error) {
        console.error('[Check Live Streams] 檢查所有直播時發生錯誤:', error);
        throw error;
    }
}

function updateMerchantActiveTime(merchantId) {
    ACTIVE_MERCHANTS.set(merchantId, Date.now());
}

module.exports = {
    checkYoutubeLiveStreams,
    updateMerchantActiveTime,
};
