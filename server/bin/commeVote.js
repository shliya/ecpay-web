const path = require('path');
const {
    parseYoutubeVideoId,
    parseYoutubeLiveChatId,
    getLiveChatMessages,
    getChannelIdByUserHandel,
    getChannelIdByChannelId,
    extractSuperChatInfo,
} = require('../lib/youtubeApi');

const {
    updateCommeTarget,
    updateCommeVote,
} = require('../service/vtuber-chat-api');
const { createDonation } = require('../service/donation');
const { ENUM_DONATION_TYPE } = require('../lib/enum');

require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });
const channelHandel = process.env.CHANNEL_HANDEL;
const liveUrl = process.env.LIVE_URL;
const MERCHANT_ID = process.env.MERCHANT_ID || '';

(async function () {
    try {
        const videoId = parseYoutubeVideoId(liveUrl);
        const liveChatId = await parseYoutubeLiveChatId(videoId);
        const clientId = await getChannelIdByUserHandel(channelHandel);
        const oldMessageMap = new Map();
        const processedSuperChatIds = new Set();
        let isVote = false;
        let targetName = '';
        const channelIdSet = new Set();
        let voteArray = [];

        let nextPageToken = null;

        async function pollMessages() {
            console.log('pollMessages start');
            const {
                messages,
                newNextPageToken,
                pollingIntervalMillis = 5000,
            } = await getLiveChatMessages(liveChatId, nextPageToken);

            nextPageToken = newNextPageToken;

            for (const message of messages) {
                const { channelId, displayName } = message.authorDetails;
                const { publishedAt, displayMessage, liveChatId } =
                    message.snippet;
                const key = `${channelId}-${publishedAt}`;
                const { snippet } = await getChannelIdByChannelId(channelId);

                if (!oldMessageMap.has(key)) {
                    if (channelId === clientId) {
                        if (displayMessage.includes('投票:')) {
                            isVote = true;
                            targetName = displayMessage;
                            console.log(`投票開始，標的物:${targetName}`);
                        } else if (displayMessage.includes('投票截止')) {
                            isVote = false;
                            console.log(`=====投票結束=====`);
                            voteArray = [];
                            channelIdSet.clear();
                        }
                    }

                    if (isVote && displayMessage.includes('!投')) {
                        if (!channelIdSet.has(channelId)) {
                            channelIdSet.add(channelId);
                            voteArray.push(displayName);
                        }
                    }

                    oldMessageMap.set(key, {
                        author: displayName,
                        message: displayMessage,
                        time: publishedAt,
                        userCreateAt: snippet.publishedAt,
                    });
                }

                const superChatInfo = extractSuperChatInfo(message);
                if (
                    superChatInfo &&
                    !processedSuperChatIds.has(superChatInfo.messageId)
                ) {
                    processedSuperChatIds.add(superChatInfo.messageId);

                    if (MERCHANT_ID) {
                        await createDonation({
                            merchantId: MERCHANT_ID,
                            name: superChatInfo.displayName,
                            cost: Math.floor(superChatInfo.amount),
                            message: superChatInfo.displayMessage || '',
                            type: ENUM_DONATION_TYPE.YOUTUBE_SUPER_CHAT,
                        });
                        console.log(
                            `Super Chat: ${superChatInfo.displayName} 贊助了 ${superChatInfo.amount} ${superChatInfo.currency}`
                        );
                    } else {
                        console.log(
                            `Super Chat: ${superChatInfo.displayName} 贊助了 ${superChatInfo.amount} ${superChatInfo.currency} - ${superChatInfo.displayMessage}`
                        );
                    }
                }
            }

            const voteObject = Object.fromEntries(oldMessageMap);
            if (isVote) {
                updateCommeVote({
                    name: targetName,
                    vote: voteArray,
                });
            }
            updateCommeTarget(voteObject);
            setTimeout(() => {
                pollMessages();
            }, pollingIntervalMillis);
        }

        pollMessages();
    } catch (error) {
        throw error;
    }
})();
