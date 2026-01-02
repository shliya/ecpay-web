const {
    parseYoutubeLiveChatId,
    getLiveChatMessages,
    getChannelIdByUserHandel,
    getChannelLiveStreamByChannelId,
    extractSuperChatInfo,
} = require('../lib/youtubeApi');
const { createDonation } = require('./donation');
const { ENUM_DONATION_TYPE } = require('../lib/enum');
const DonationStore = require('../store/donation');
const { convertToTWD } = require('../lib/currency-converter');

const activePollingTasks = new Map();

async function startPollingSuperChat(merchantId, config) {
    const taskKey = `merchant-${merchantId}`;

    if (activePollingTasks.has(taskKey)) {
        console.log(`[YouTube Super Chat] ${merchantId} 已在監聽中，跳過`);
        return;
    }

    const channelHandle = config.youtubeChannelHandle;
    const channelId = config.youtubeChannelId;

    if (!channelHandle) {
        console.log(
            `[YouTube Super Chat] ${merchantId} 未設定 YouTube Channel Handle`
        );
        return;
    }

    try {
        console.log(
            `[YouTube Super Chat] 開始監聽 ${merchantId} (${channelHandle})`
        );

        let resolvedChannelId = channelId;
        if (!resolvedChannelId) {
            resolvedChannelId = await getChannelIdByUserHandel(channelHandle);
            if (!resolvedChannelId) {
                console.error(
                    `[YouTube Super Chat] ${merchantId} 找不到頻道: ${channelHandle}`
                );
                return;
            }
        }

        const liveStream =
            await getChannelLiveStreamByChannelId(resolvedChannelId);

        if (!liveStream) {
            console.log(
                `[YouTube Super Chat] ${merchantId} 目前沒有正在進行的直播`
            );
            return;
        }

        const { newLiveStreamTitle, newLiveStreamId } = liveStream;
        console.log(
            `[YouTube Super Chat] ${merchantId} 找到直播: ${newLiveStreamTitle}`
        );

        const liveChatId = await parseYoutubeLiveChatId(newLiveStreamId);

        if (!liveChatId) {
            console.error(
                `[YouTube Super Chat] ${merchantId} 無法獲取聊天室 ID`
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
                `[YouTube Super Chat] ${merchantId} 最後處理時間: ${lastProcessedTime.toISOString()}`
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

                        const originalAmount = superChatInfo.amount;
                        const originalCurrency = superChatInfo.currency;
                        const convertedAmountTWD = await convertToTWD(
                            originalAmount,
                            originalCurrency
                        );
                        const costInTWD = Math.floor(convertedAmountTWD);

                        const isDuplicate =
                            await DonationStore.checkDuplicateSuperChat(
                                merchantId,
                                superChatInfo.displayName,
                                costInTWD,
                                superChatInfo.displayMessage || '',
                                superChatInfo.publishedAt
                            );

                        if (!isDuplicate) {
                            await createDonation({
                                merchantId,
                                name: superChatInfo.displayName,
                                cost: costInTWD,
                                message: superChatInfo.displayMessage || '',
                                type: ENUM_DONATION_TYPE.YOUTUBE_SUPER_CHAT,
                            });

                            if (originalCurrency !== 'TWD') {
                                console.log(
                                    `[YouTube Super Chat] ${merchantId}: ${superChatInfo.displayName} 贊助了 ${originalAmount} ${originalCurrency} (約 ${convertedAmountTWD} TWD)`
                                );
                            } else {
                                console.log(
                                    `[YouTube Super Chat] ${merchantId}: ${superChatInfo.displayName} 贊助了 ${originalAmount} ${originalCurrency}`
                                );
                            }
                        } else {
                            console.log(
                                `[YouTube Super Chat] ${merchantId}: 跳過重複的 Super Chat - ${superChatInfo.displayName} ${originalAmount} ${originalCurrency}`
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
                    `[YouTube Super Chat] ${merchantId} 輪詢錯誤:`,
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
            console.log(`[YouTube Super Chat] ${merchantId} 已停止監聽`);
        };

        activePollingTasks.set(taskKey, {
            stop: stopPolling,
            merchantId,
            channelHandle,
        });

        pollMessages();
    } catch (error) {
        console.error(`[YouTube Super Chat] ${merchantId} 啟動錯誤:`, error);
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
