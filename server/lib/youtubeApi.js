const axios = require('axios');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });
const apiKey = process.env.API_KEY;
const googleApiBaseUrl = `https://www.googleapis.com/youtube/v3/`;

function parseYoutubeVideoId(url) {
    const regex =
        /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:watch\?v=|live\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/;
    const match = url.match(regex);
    return match ? match[1] : null;
}

async function parseYoutubeLiveChatId(videoId) {
    const url = `${googleApiBaseUrl}videos`;
    try {
        const response = await axios.get(url, {
            params: {
                part: 'liveStreamingDetails',
                id: videoId,
                key: apiKey,
            },
        });

        const chatId =
            response.data.items[0]?.liveStreamingDetails?.activeLiveChatId;
        return chatId;
    } catch (error) {
        throw error;
    }
}

async function getChannelIdByUserHandel(userHandel) {
    const url = `${googleApiBaseUrl}channels`;

    try {
        const response = await axios.get(url, {
            params: {
                part: 'id',
                forHandle: userHandel,
                key: apiKey,
            },
        });
        const channel = response.data.items[0];
        if (channel) {
            return channel.id;
        } else {
            console.log('未找到該頻道');
            return null;
        }
    } catch (error) {
        console.error('錯誤:', error);
    }
}

async function getChannelIdByChannelId(channelId) {
    const url = `${googleApiBaseUrl}channels`;

    try {
        const response = await axios.get(url, {
            params: {
                part: 'id, snippet',
                id: channelId,
                key: apiKey,
            },
        });
        const channel = response.data.items[0];
        if (channel) {
            return channel;
        } else {
            console.log('未找到該頻道');
            return null;
        }
    } catch (error) {
        console.error('錯誤:', error);
    }
}

async function getLiveChatMessages(chatId, pageToken = null) {
    const url = `${googleApiBaseUrl}liveChat/messages`;

    const params = {
        liveChatId: chatId,
        part: 'snippet,authorDetails',
        key: apiKey,
    };

    if (pageToken) {
        params.pageToken = pageToken;
    }

    try {
        const response = await axios.get(url, {
            params,
        });

        const messages = response.data.items;
        const newNextPageToken = response.data.nextPageToken;
        const pollingIntervalMillis =
            response.data.pollingIntervalMillis || 5000;

        return {
            messages,
            newNextPageToken,
            pollingIntervalMillis,
        };
    } catch (error) {
        throw error;
    }
}

async function getChannelUpComingStreamByChannelId(channelId) {
    const url = `${googleApiBaseUrl}search`;
    try {
        const response = await axios.get(url, {
            params: {
                part: 'snippet',
                channelId: channelId,
                eventType: 'upcoming',
                type: 'video',
                order: 'date',
                key: apiKey,
            },
        });

        const items = response.data.items;
        if (items.length > 0) {
            const liveStream = items[0];
            const newUpcomingStreamTitle = liveStream.snippet.title;
            const newUpcomingStreamId = liveStream.id.videoId;
            const newUpcomingStreamUrl = liveStream.id.videoId;
            return {
                newUpcomingStreamTitle,
                newUpcomingStreamId,
                newUpcomingStreamUrl,
            };
        } else {
            console.log('沒有發現新的直播間');
        }
    } catch (error) {
        console.error('錯誤:', error);
    }
}

async function getChannelLiveStreamByChannelId(channelId) {
    const url = `${googleApiBaseUrl}search`;
    try {
        const response = await axios.get(url, {
            params: {
                part: 'snippet',
                channelId: channelId,
                eventType: 'live',
                type: 'video',
                order: 'date',
                key: apiKey,
            },
        });
        const items = response.data.items;

        if (items.length > 0) {
            const liveStream = items[0];
            const newLiveStreamTitle = liveStream.snippet.title;
            const newLiveStreamId = liveStream.id.videoId;
            return {
                newLiveStreamTitle,
                newLiveStreamId,
            };
        } else {
            console.log('沒有發現新的直播間');
        }
    } catch (error) {
        console.error('錯誤:', error);
    }
}

async function getChannelVideoByChannelId(channelId, pageToken = '') {
    const url = `${googleApiBaseUrl}search`;
    try {
        const response = await axios.get(url, {
            params: {
                part: 'snippet',
                channelId: channelId,
                type: 'video',
                key: apiKey,
                maxResults: 50,
                pageToken: pageToken,
            },
        });

        const voids = [];
        const items = response.data.items;
        const regexTitle = /【([^】]+)】/;
        if (items.length > 0) {
            items.forEach(item => {
                const videoTitle = item.snippet.title;
                const videoId = item.snippet.UCaTcioLFOsSQt6sO0ZYDKxQ;
                const match = videoTitle.match(regexTitle);
                if (videoTitle.includes('cover')) {
                    console.log(`影片標題: ${videoTitle}`);
                }
                // if (match) {
                //   if (match[1].includes("歌ってみた") || match[1].includes("cover")) {
                //     console.log(`影片標題: ${videoTitle}`);
                //   }
                // }
            });
        } else {
            console.log('沒有發現新的直播間');
        }
        const nextPageToken = response.data.nextPageToken;
        if (nextPageToken) {
            // 如果有下一頁，遞迴抓取下一頁的影片
            await getChannelVideoByChannelId(channelId, nextPageToken);
        }
    } catch (error) {
        console.error('錯誤:', error);
    }
}

function extractSuperChatInfo(message) {
    const messageType = message.snippet?.messageType;
    const superChatDetails = message.snippet?.superChatDetails;

    if (messageType !== 'superChatEvent' && !superChatDetails) {
        return null;
    }

    const amountMicros = superChatDetails?.amountMicros;
    const currency = superChatDetails?.currency;
    const displayName = message.authorDetails?.displayName;
    const channelId = message.authorDetails?.channelId;
    const publishedAt = message.snippet?.publishedAt;
    const userComment = superChatDetails?.userComment || '';

    const amount = amountMicros ? amountMicros / 1000000 : null;

    return {
        messageType,
        amount,
        amountMicros,
        currency,
        displayName,
        channelId,
        publishedAt,
        displayMessage: userComment,
        messageId: message.id,
    };
}

function filterSuperChatMessages(messages) {
    return messages
        .map(message => extractSuperChatInfo(message))
        .filter(superChatInfo => superChatInfo !== null);
}

module.exports = {
    parseYoutubeVideoId,
    parseYoutubeLiveChatId,
    getLiveChatMessages,
    extractSuperChatInfo,
    filterSuperChatMessages,
    getChannelIdByUserHandel,
    getChannelUpComingStreamByChannelId,
    getChannelLiveStreamByChannelId,
    getChannelVideoByChannelId,
    getChannelIdByChannelId,
};
