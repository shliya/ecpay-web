const axios = require('axios');
const path = require('path');
const xml2js = require('xml2js');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });
const apiKey = process.env.API_KEY;
const googleApiBaseUrl = `https://www.googleapis.com/youtube/v3/`;

/** videos.list 單次最多可帶 50 個 id，且不論幾個都只算 1 quota */
const VIDEOS_LIST_MAX_IDS = 50;
const UPLOADS_MAX_RESULTS = 15;
const LIVE_LOOKBACK_HOURS = 48;
const RSS_TIMEOUT_MS = 10000;

/**
 * search.list 自 2026/06/01 起有獨立配額桶，每天僅 100 次呼叫，用完直播就偵測不到。
 * 預設關閉，僅在 .env 明確開啟時才會退回 search。
 */
const ALLOW_SEARCH_FALLBACK =
    process.env.YOUTUBE_ALLOW_SEARCH_FALLBACK === 'true' ||
    process.env.YOUTUBE_ALLOW_SEARCH_FALLBACK === '1';

function parseYoutubeVideoId(url) {
    const regex =
        /(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:watch\?v=|live\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/;
    const match = url.match(regex);
    return match ? match[1] : null;
}

/**
 * 讀取頻道 RSS 的近期影片清單（不消耗任何 API 配額）
 * @returns {Promise<Array<{videoId: string, title: string, published: string}>|null>}
 *          null 代表讀取失敗，[] 代表頻道沒有影片
 */
async function getRecentVideosFromRss(channelId) {
    try {
        const rssUrl = `https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`;
        const response = await axios.get(rssUrl, { timeout: RSS_TIMEOUT_MS });
        const parser = new xml2js.Parser({ explicitArray: false });
        const result = await parser.parseStringPromise(response.data);

        if (!result.feed || !result.feed.entry) {
            return [];
        }

        const entries = Array.isArray(result.feed.entry)
            ? result.feed.entry
            : [result.feed.entry];

        return entries
            .map(entry => ({
                videoId: entry['yt:videoId'],
                title: entry.title,
                published: entry.published,
            }))
            .filter(video => Boolean(video.videoId));
    } catch (error) {
        console.warn(`[RSS] 讀取失敗 ${channelId}: ${error.message}`);
        return null;
    }
}

async function getLatestVideoFromRss(channelId) {
    const videos = await getRecentVideosFromRss(channelId);
    return videos && videos.length > 0 ? videos[0] : null;
}

/** 頻道的 uploads 播放清單 ID：UCxxx -> UUxxx */
function toUploadsPlaylistId(channelId) {
    if (!channelId || !channelId.startsWith('UC')) {
        return null;
    }
    return `UU${channelId.slice(2)}`;
}

/**
 * 從 uploads 播放清單讀近期影片（1 quota）。
 * RSS 對「剛開台的直播」偶爾會延遲幾分鐘，這條路徑跟後台同步，用來補洞。
 */
async function getRecentVideosFromUploads(
    channelId,
    maxResults = UPLOADS_MAX_RESULTS
) {
    const playlistId = toUploadsPlaylistId(channelId);
    if (!playlistId) {
        return null;
    }

    const url = `${googleApiBaseUrl}playlistItems`;
    try {
        const response = await axios.get(url, {
            params: {
                part: 'contentDetails',
                playlistId,
                maxResults,
                key: apiKey,
            },
        });

        return (response.data.items || [])
            .map(item => ({
                videoId: item.contentDetails?.videoId,
                published: item.contentDetails?.videoPublishedAt,
            }))
            .filter(video => Boolean(video.videoId));
    } catch (error) {
        console.warn(
            `[Uploads Playlist] 讀取失敗 ${channelId}: ${error.message}`
        );
        return null;
    }
}

/**
 * 一次 videos.list 批次檢查多支影片是否為直播中（最多 50 個 id 也只算 1 quota）。
 * 同時帶回 activeLiveChatId，省掉之後再打一次 parseYoutubeLiveChatId。
 */
async function findLiveVideoByIds(videoIds) {
    if (!videoIds || videoIds.length === 0) {
        return null;
    }

    const url = `${googleApiBaseUrl}videos`;
    try {
        const response = await axios.get(url, {
            params: {
                part: 'snippet,liveStreamingDetails',
                id: videoIds.slice(0, VIDEOS_LIST_MAX_IDS).join(','),
                key: apiKey,
            },
        });

        const liveVideo = (response.data.items || []).find(
            item => item.snippet?.liveBroadcastContent === 'live'
        );
        if (!liveVideo) {
            return null;
        }

        return {
            newLiveStreamTitle: liveVideo.snippet.title,
            newLiveStreamId: liveVideo.id,
            liveChatId:
                liveVideo.liveStreamingDetails?.activeLiveChatId || null,
        };
    } catch (error) {
        console.error('[FindLiveVideoByIds] 錯誤:', error.message);
        return null;
    }
}

async function checkVideoIsLive(videoId) {
    const url = `${googleApiBaseUrl}videos`;
    try {
        const response = await axios.get(url, {
            params: {
                part: 'snippet',
                id: videoId,
                key: apiKey,
            },
        });

        const items = response.data.items;
        if (items.length > 0) {
            const video = items[0];
            if (video.snippet.liveBroadcastContent === 'live') {
                return {
                    newLiveStreamTitle: video.snippet.title,
                    newLiveStreamId: video.id,
                };
            }
        }
        return null;
    } catch (error) {
        console.error('[CheckVideoIsLive] Error:', error.message);
        return null;
    }
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

/**
 * 偵測頻道是否正在直播。
 *
 * 成本：RSS（0 quota）+ uploads 播放清單（1 quota）+ 一次批次 videos.list（1 quota）。
 * 不再使用 search.list —— 2026/06/01 起它有獨立配額桶，每天只有 100 次。
 */
async function getChannelLiveStreamByChannelId(channelId) {
    const now = Date.now();
    const lookbackMs = LIVE_LOOKBACK_HOURS * 60 * 60 * 1000;
    const seenVideoIds = new Set();
    const candidateIds = [];

    const collectCandidates = videos => {
        if (!videos) {
            return;
        }
        for (const video of videos) {
            if (seenVideoIds.has(video.videoId)) {
                continue;
            }
            if (video.published) {
                const publishTime = new Date(video.published).getTime();
                if (
                    Number.isFinite(publishTime) &&
                    now - publishTime > lookbackMs
                ) {
                    continue;
                }
            }
            seenVideoIds.add(video.videoId);
            candidateIds.push(video.videoId);
        }
    };

    collectCandidates(await getRecentVideosFromRss(channelId));
    collectCandidates(await getRecentVideosFromUploads(channelId));

    const liveStream = await findLiveVideoByIds(candidateIds);
    if (liveStream) {
        return liveStream;
    }

    if (!ALLOW_SEARCH_FALLBACK) {
        return null;
    }

    const url = `${googleApiBaseUrl}search`;
    console.warn(
        `[Youtube API Warning] Falling back to Search API for channel: ${channelId} (每日僅 100 次額度)`
    );
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
            const searchHit = items[0];
            return {
                newLiveStreamTitle: searchHit.snippet.title,
                newLiveStreamId: searchHit.id.videoId,
                liveChatId: null,
            };
        }
        console.log('沒有發現新的直播間');
        return null;
    } catch (error) {
        console.error('錯誤:', error);
        return null;
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
    getLatestVideoFromRss,
    getRecentVideosFromRss,
    getRecentVideosFromUploads,
    findLiveVideoByIds,
    checkVideoIsLive,
};
