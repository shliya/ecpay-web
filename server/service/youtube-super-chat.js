const {
    parseYoutubeLiveChatId,
    getLiveChatMessages,
    getChannelIdByUserHandel,
    getChannelLiveStreamByChannelId,
    extractSuperChatInfo,
} = require('../lib/youtubeApi');
const { createDonation } = require('./donation');
const DonationStore = require('../store/donation');
const { normalizeToDonation } = require('../lib/payment-providers/youtube');

const activePollingTasks = new Map();

async function startPollingSuperChat(merchantId, config) {
    const taskKey = `merchant-${merchantId}`;

    if (activePollingTasks.has(taskKey)) {
        console.log(`[youtube-super-chat] ${merchantId} 已在監聽中，跳過`);
        return;
    }

    const channelHandle = config.youtubeChannelHandle;
    const channelId = config.youtubeChannelId;

    if (!channelHandle) {
        console.log(
            `[youtube-super-chat] ${merchantId} 未設定 YouTube Channel Handle`
        );
        return;
    }

    try {
        console.log(
            `[youtube-super-chat] 開始監聽 ${merchantId} (${channelHandle})`
        );

        let resolvedChannelId = channelId;
        if (!resolvedChannelId) {
            resolvedChannelId = await getChannelIdByUserHandel(channelHandle);
            if (!resolvedChannelId) {
                console.error(
                    `[youtube-super-chat] ${merchantId} 找不到頻道: ${channelHandle}`
                );
                return;
            }
        }

        const liveStream =
            await getChannelLiveStreamByChannelId(resolvedChannelId);

        if (!liveStream) {
            console.log(
                `[youtube-super-chat] ${merchantId} 目前沒有正在進行的直播`
            );
            return;
        }

        const { newLiveStreamTitle, newLiveStreamId } = liveStream;
        console.log(
            `[youtube-super-chat] ${merchantId} 找到直播: ${newLiveStreamTitle}`
        );

        const liveChatId = await parseYoutubeLiveChatId(newLiveStreamId);

        if (!liveChatId) {
            console.error(
                `[youtube-super-chat] ${merchantId} 無法獲取聊天室 ID`
            );
            return;
        }

        const processedSuperChatIds = new Set();
        let nextPageToken = null;
        let isPolling = true;
        let lastProcessedTime = null;

        const lastSuperChatTime =
            await DonationStore.getLastSuperChatTime(merchantId);
        if (lastSuperChatTime) {
            lastProcessedTime = new Date(lastSuperChatTime);
            console.log(
                `[youtube-super-chat] ${merchantId} 最後處理時間: ${lastProcessedTime.toISOString()}`
            );
        }

        const pollMessages = async () => {
            if (!isPolling) {
                return;
            }

            try {
                const {
                    messages,
                    newNextPageToken,
                    pollingIntervalMillis = 5000,
                } = await getLiveChatMessages(liveChatId, nextPageToken);

                const actualPollingInterval = Math.max(
                    pollingIntervalMillis,
                    30000 // 調整為最小 30 秒，節省 API Quota
                );

                if (messages && messages.length > 0) {
                    for (const message of messages) {
                        const superChatInfo = extractSuperChatInfo(message);

                        if (!superChatInfo) {
                            continue;
                        }

                        if (
                            processedSuperChatIds.has(superChatInfo.messageId)
                        ) {
                            continue;
                        }

                        if (lastProcessedTime && superChatInfo.publishedAt) {
                            const publishedTime = new Date(
                                superChatInfo.publishedAt
                            );
                            if (publishedTime <= lastProcessedTime) {
                                processedSuperChatIds.add(
                                    superChatInfo.messageId
                                );
                                continue;
                            }
                        }

                        processedSuperChatIds.add(superChatInfo.messageId);

                        const row = await normalizeToDonation(
                            superChatInfo,
                            merchantId
                        );

                        const isDuplicate =
                            await DonationStore.checkDuplicateSuperChat(
                                merchantId,
                                row.name,
                                row.cost,
                                row.message,
                                superChatInfo.publishedAt
                            );

                        if (!isDuplicate) {
                            await createDonation(row);

                            const originalAmount = superChatInfo.amount;
                            const originalCurrency =
                                superChatInfo.currency || 'TWD';
                            if (originalCurrency !== 'TWD') {
                                console.log(
                                    `[youtube-super-chat] ${merchantId}: ${row.name} 贊助了 ${originalAmount} ${originalCurrency} (約 ${row.cost} TWD)`
                                );
                            } else {
                                console.log(
                                    `[youtube-super-chat] ${merchantId}: ${row.name} 贊助了 ${originalAmount} ${originalCurrency}`
                                );
                            }
                        } else {
                            const originalAmount = superChatInfo.amount;
                            const originalCurrency =
                                superChatInfo.currency || 'TWD';
                            console.log(
                                `[youtube-super-chat] ${merchantId}: 跳過重複的 Super Chat - ${row.name} ${originalAmount} ${originalCurrency}`
                            );
                        }
                    }
                }

                nextPageToken = newNextPageToken;

                if (isPolling) {
                    setTimeout(pollMessages, actualPollingInterval);
                }
            } catch (error) {
                console.error(
                    `[youtube-super-chat] ${merchantId} 輪詢錯誤:`,
                    error.message
                );
                if (isPolling) {
                    setTimeout(pollMessages, 60000); // 錯誤時等待 60 秒再試
                }
            }
        };

        const stopPolling = () => {
            isPolling = false;
            activePollingTasks.delete(taskKey);
            console.log(`[youtube-super-chat] ${merchantId} 已停止監聽`);
        };

        activePollingTasks.set(taskKey, {
            stop: stopPolling,
            merchantId,
            channelHandle,
        });

        pollMessages();
    } catch (error) {
        console.error(`[youtube-super-chat] ${merchantId} 啟動錯誤:`, error);
        activePollingTasks.delete(taskKey);
    }
}

function stopPollingSuperChat(merchantId) {
    const taskKey = `merchant-${merchantId}`;
    const task = activePollingTasks.get(taskKey);

    if (task) {
        task.stop();
    }
}

function stopAllPolling() {
    activePollingTasks.forEach(task => {
        task.stop();
    });
}

function getActivePollingTasks() {
    return Array.from(activePollingTasks.values()).map(task => ({
        merchantId: task.merchantId,
        channelHandle: task.channelHandle,
    }));
}

module.exports = {
    startPollingSuperChat,
    stopPollingSuperChat,
    stopAllPolling,
    getActivePollingTasks,
};
