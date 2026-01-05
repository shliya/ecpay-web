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

const CACHE_DURATION_WITH_LIVE = 2 * 60 * 1000;
const CACHE_DURATION_WITHOUT_LIVE = 5 * 60 * 1000; // 5分鐘檢查一次

function isMerchantActive(merchantId) {
    if (process.env.NODE_ENV === 'development') {
        return true;
    }
    const lastActive = ACTIVE_MERCHANTS.get(merchantId);
    if (!lastActive) return false;
    return Date.now() - lastActive < ACTIVE_TIMEOUT;
}

function shouldSkipCheck(merchantId, hasLiveStream) {
    const cacheKey = merchantId;
    const cached = CHECK_CACHE.get(cacheKey);

    if (!cached) {
        return false;
    }

    const now = Date.now();
    const timeSinceLastCheck = now - cached.lastCheckTime;
    const cacheDuration = hasLiveStream
        ? CACHE_DURATION_WITH_LIVE
        : CACHE_DURATION_WITHOUT_LIVE;

    if (timeSinceLastCheck < cacheDuration) {
        return true;
    }

    return false;
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
                const cached = CHECK_CACHE.get(merchantId);
                const isCurrentlyPolling = activeMerchantIds.has(merchantId);

                if (isCurrentlyPolling) {
                    const cacheDuration = CACHE_DURATION_WITH_LIVE;
                    if (
                        cached &&
                        cached.hasLiveStream &&
                        Date.now() - cached.lastCheckTime < cacheDuration
                    ) {
                        console.log(
                            `[Check Live Streams] ${merchantId} 正在輪詢且快取有效 (Live)`
                        );
                        continue;
                    }
                } else if (
                    shouldSkipCheck(merchantId, cached?.hasLiveStream || false)
                ) {
                    console.log(
                        `[Check Live Streams] ${merchantId} 快取有效 (No Live) 跳過檢查`
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
                    if (!activeMerchantIds.has(merchantId)) {
                        console.log(
                            `[Check Live Streams] ${merchantId} 開始輪詢`
                        );
                        await startPollingSuperChat(merchantId, config);
                    } else {
                        console.log(
                            `[Check Live Streams] ${merchantId} 已在輪詢中`
                        );
                    }
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
