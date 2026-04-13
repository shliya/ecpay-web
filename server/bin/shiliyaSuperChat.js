const path = require('path');
const {
    parseYoutubeLiveChatId,
    getLiveChatMessages,
    getChannelIdByUserHandel,
    getChannelLiveStreamByChannelId,
    extractSuperChatInfo,
} = require('../lib/youtubeApi');

require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

const TARGET_HANDLE = '@shiliyahamster';

(async function () {
    try {
        console.log(`[Init] 正在搜尋 ${TARGET_HANDLE} 的頻道資訊...`);
        const channelId = await getChannelIdByUserHandel(TARGET_HANDLE);

        if (!channelId) {
            console.error(`[Error] 找不到 handle 為 ${TARGET_HANDLE} 的頻道`);
            return;
        }
        console.log(`[Info] 頻道 ID: ${channelId}`);

        console.log(`[Init] 正在搜尋頻道目前的直播...`);
        const liveStream = await getChannelLiveStreamByChannelId(channelId);

        if (!liveStream) {
            console.log(`[Info] ${TARGET_HANDLE} 目前沒有正在進行的直播。`);
            return;
        }

        const { newLiveStreamTitle, newLiveStreamId } = liveStream;
        console.log(
            `[Info] 找到直播: ${newLiveStreamTitle} (ID: ${newLiveStreamId})`
        );

        console.log(`[Init] 正在獲取聊天室 ID...`);
        const liveChatId = await parseYoutubeLiveChatId(newLiveStreamId);

        if (!liveChatId) {
            console.error(
                `[Error] 無法獲取直播影片 ${newLiveStreamId} 的聊天室 ID。`
            );
            return;
        }
        console.log(`[Info] 聊天室 ID: ${liveChatId}`);

        const processedSuperChatIds = new Set();
        console.log(`[Start] 開始監聽 Super Chat...`);

        async function pollMessages() {
            try {
                const { messages, pollingIntervalMillis = 5000 } =
                    await getLiveChatMessages(liveChatId);

                if (messages && messages.length > 0) {
                    for (const message of messages) {
                        const superChatInfo = extractSuperChatInfo(message);

                        if (
                            superChatInfo &&
                            !processedSuperChatIds.has(superChatInfo.messageId)
                        ) {
                            processedSuperChatIds.add(superChatInfo.messageId);

                            const amount = superChatInfo.amount;
                            const currency = superChatInfo.currency;
                            const displayName = superChatInfo.displayName;
                            const displayMessage =
                                superChatInfo.displayMessage || '(無留言)';

                            console.log(
                                `[Super Chat] ${displayName} 贊助了 ${amount} ${currency}: ${displayMessage}`
                            );
                        }
                    }
                }

                setTimeout(pollMessages, pollingIntervalMillis);
            } catch (error) {
                console.error('[Polling Error]', error.message);
                setTimeout(pollMessages, 10000);
            }
        }

        pollMessages();
    } catch (error) {
        console.error('[Main Error]', error);
    }
})();
