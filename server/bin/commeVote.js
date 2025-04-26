const path = require('path');
const {
    parseYoutubeVideoId,
    parseYoutubeLiveChatId,
    getLiveChatMessages,
    getChannelIdByUserHandel,
    getChannelIdByChannelId,
} = require('../lib/youtubeApi');

const {
    updateCommeTarget,
    updateCommeVote,
} = require('../service/vtuber-chat-api');

require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });
const channelHandel = process.env.CHANNEL_HANDEL;
const liveUrl = process.env.LIVE_URL;

(async function () {
    try {
        const videoId = parseYoutubeVideoId(liveUrl);
        const liveChatId = await parseYoutubeLiveChatId(videoId);
        const clientId = await getChannelIdByUserHandel(channelHandel);
        const oldMessageMap = new Map();
        let isVote = false;
        let targetName = '';
        const channelIdSet = new Set();
        let voteArray = [];

        async function pollMessages() {
            console.log('pollMessages start');
            const {
                messages,
                newNextPageToken,
                intervalMillis = 5000,
            } = await getLiveChatMessages(liveChatId);

            messages.forEach(async message => {
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
            });

            const voteObject = Object.fromEntries(oldMessageMap);
            if (isVote) {
                updateCommeVote({
                    name: targetName,
                    vote: voteArray,
                });
            }
            updateCommeTarget(voteObject);
            setTimeout(() => {
                pollMessages(newNextPageToken);
            }, intervalMillis);
        }

        pollMessages();
    } catch (error) {
        throw error;
    }
})();
