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

const LOG_PREFIX = '[youtube-super-chat]';
const MAX_PROCESSED_IDS = 10000;
const MIN_POLLING_INTERVAL_MS = 30000;
const ERROR_RETRY_BASE_MS = 60000;
const MAX_RETRY_BACKOFF_MS = 600000;

const activePollingTasks = new Map();

function isUnrecoverableError(error) {
    const message = error.message || '';
    return (
        message.includes('liveChatEnded') ||
        message.includes('liveChatNotFound') ||
        message.includes('forbidden') ||
        error.response?.status === 403
    );
}

function trimProcessedIds(idSet, maxSize) {
    if (idSet.size <= maxSize) {
        return;
    }
    let toRemove = idSet.size - maxSize;
    for (const id of idSet) {
        if (toRemove-- <= 0) {
            break;
        }
        idSet.delete(id);
    }
}

function logSuperChat(
    merchantId,
    name,
    amount,
    currency,
    { isDuplicate, costTWD }
) {
    if (isDuplicate) {
        console.log(
            `${LOG_PREFIX} ${merchantId}: 跳過重複的 Super Chat - ${name} ${amount} ${currency}`
        );
        return;
    }
    const suffix = currency !== 'TWD' ? ` (約 ${costTWD} TWD)` : '';
    console.log(
        `${LOG_PREFIX} ${merchantId}: ${name} 贊助了 ${amount} ${currency}${suffix}`
    );
}

async function resolveChannelId(merchantId, channelHandle, channelId) {
    if (channelId) {
        return channelId;
    }
    const resolved = await getChannelIdByUserHandel(channelHandle);
    if (!resolved) {
        console.error(
            `${LOG_PREFIX} ${merchantId} 找不到頻道: ${channelHandle}`
        );
    }
    return resolved || null;
}

async function resolveLiveChatId(merchantId, channelId) {
    const liveStream = await getChannelLiveStreamByChannelId(channelId);
    if (!liveStream) {
        console.log(`${LOG_PREFIX} ${merchantId} 目前沒有正在進行的直播`);
        return null;
    }

    console.log(
        `${LOG_PREFIX} ${merchantId} 找到直播: ${liveStream.newLiveStreamTitle}`
    );
    const liveChatId = await parseYoutubeLiveChatId(liveStream.newLiveStreamId);
    if (!liveChatId) {
        console.error(`${LOG_PREFIX} ${merchantId} 無法獲取聊天室 ID`);
    }
    return liveChatId || null;
}

function isAlreadyProcessed(superChatInfo, processedIds, lastProcessedTime) {
    if (processedIds.has(superChatInfo.messageId)) {
        return true;
    }
    if (lastProcessedTime && superChatInfo.publishedAt) {
        const publishedTime = new Date(superChatInfo.publishedAt);
        if (publishedTime <= lastProcessedTime) {
            processedIds.add(superChatInfo.messageId);
            return true;
        }
    }
    return false;
}

async function processSuperChatMessage(merchantId, superChatInfo) {
    const row = await normalizeToDonation(superChatInfo, merchantId);

    const isDuplicate = await DonationStore.checkDuplicateSuperChat(
        merchantId,
        row.name,
        row.cost,
        row.message,
        superChatInfo.publishedAt
    );

    const originalAmount = superChatInfo.amount;
    const originalCurrency = superChatInfo.currency || 'TWD';

    if (!isDuplicate) {
        await createDonation(row);
    }

    logSuperChat(merchantId, row.name, originalAmount, originalCurrency, {
        isDuplicate,
        costTWD: row.cost,
    });
}

async function startPollingSuperChat(merchantId, config) {
    const taskKey = `merchant-${merchantId}`;

    if (activePollingTasks.has(taskKey)) {
        console.log(`${LOG_PREFIX} ${merchantId} 已在監聽中，跳過`);
        return;
    }

    const { youtubeChannelHandle: channelHandle, youtubeChannelId: channelId } =
        config;
    if (!channelHandle) {
        console.log(
            `${LOG_PREFIX} ${merchantId} 未設定 YouTube Channel Handle`
        );
        return;
    }

    activePollingTasks.set(taskKey, {
        starting: true,
        merchantId,
        channelHandle,
    });

    try {
        console.log(`${LOG_PREFIX} 開始監聯 ${merchantId} (${channelHandle})`);

        const resolvedChannelId = await resolveChannelId(
            merchantId,
            channelHandle,
            channelId
        );
        if (!resolvedChannelId) {
            activePollingTasks.delete(taskKey);
            return;
        }

        const liveChatId = await resolveLiveChatId(
            merchantId,
            resolvedChannelId
        );
        if (!liveChatId) {
            activePollingTasks.delete(taskKey);
            return;
        }

        const processedSuperChatIds = new Set();
        let nextPageToken = null;
        let isPolling = true;
        let pendingTimer = null;
        let consecutiveErrors = 0;

        const lastSuperChatTime =
            await DonationStore.getLastSuperChatTime(merchantId);
        let lastProcessedTime = lastSuperChatTime
            ? new Date(lastSuperChatTime)
            : null;
        if (lastProcessedTime) {
            console.log(
                `${LOG_PREFIX} ${merchantId} 最後處理時間: ${lastProcessedTime.toISOString()}`
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

                consecutiveErrors = 0;
                const actualPollingInterval = Math.max(
                    pollingIntervalMillis,
                    MIN_POLLING_INTERVAL_MS
                );

                if (messages?.length) {
                    for (const message of messages) {
                        const superChatInfo = extractSuperChatInfo(message);
                        if (!superChatInfo) {
                            continue;
                        }
                        if (
                            isAlreadyProcessed(
                                superChatInfo,
                                processedSuperChatIds,
                                lastProcessedTime
                            )
                        ) {
                            continue;
                        }

                        processedSuperChatIds.add(superChatInfo.messageId);
                        trimProcessedIds(
                            processedSuperChatIds,
                            MAX_PROCESSED_IDS
                        );

                        try {
                            await processSuperChatMessage(
                                merchantId,
                                superChatInfo
                            );
                        } catch (msgError) {
                            console.error(
                                `${LOG_PREFIX} ${merchantId} 處理訊息失敗:`,
                                msgError
                            );
                        }
                    }
                }

                nextPageToken = newNextPageToken;

                if (isPolling) {
                    pendingTimer = setTimeout(
                        pollMessages,
                        actualPollingInterval
                    );
                }
            } catch (error) {
                console.error(`${LOG_PREFIX} ${merchantId} 輪詢錯誤:`, error);

                if (isUnrecoverableError(error)) {
                    console.log(
                        `${LOG_PREFIX} ${merchantId} 偵測到不可恢復錯誤，停止輪詢`
                    );
                    stopPolling();
                    return;
                }

                consecutiveErrors++;
                if (isPolling) {
                    const backoff = Math.min(
                        ERROR_RETRY_BASE_MS *
                            Math.pow(2, consecutiveErrors - 1),
                        MAX_RETRY_BACKOFF_MS
                    );
                    pendingTimer = setTimeout(pollMessages, backoff);
                }
            }
        };

        const stopPolling = () => {
            isPolling = false;
            if (pendingTimer) {
                clearTimeout(pendingTimer);
                pendingTimer = null;
            }
            activePollingTasks.delete(taskKey);
            console.log(`${LOG_PREFIX} ${merchantId} 已停止監聽`);
        };

        activePollingTasks.set(taskKey, {
            stop: stopPolling,
            merchantId,
            channelHandle,
        });

        pollMessages().catch(error => {
            console.error(`${LOG_PREFIX} ${merchantId} 首次輪詢失敗:`, error);
            activePollingTasks.delete(taskKey);
        });
    } catch (error) {
        console.error(`${LOG_PREFIX} ${merchantId} 啟動錯誤:`, error);
        activePollingTasks.delete(taskKey);
    }
}

function stopPollingSuperChat(merchantId) {
    const taskKey = `merchant-${merchantId}`;
    const task = activePollingTasks.get(taskKey);

    if (task?.stop) {
        task.stop();
    }
}

function stopAllPolling() {
    activePollingTasks.forEach(task => {
        if (task.stop) {
            task.stop();
        }
    });
}

function getActivePollingTasks() {
    return Array.from(activePollingTasks.values())
        .filter(task => !task.starting)
        .map(task => ({
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
