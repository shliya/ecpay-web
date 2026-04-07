/**
 * YouTube 斗內影片：videoId 解析、網址內起始時間（t= / start=）、金額換算播放秒數、videoTask 結構。
 * 規則：每 30 元 +5 秒，最少 5 秒（金額須 ≥30），上限 30 秒。
 * 付款回調欄位長度有限時，使用緊湊格式：videoId@startSec（例如 zqbDOwWFJwk@19）。
 */

const YOUTUBE_VIDEO_ID_RE = /^[a-zA-Z0-9_-]{11}$/;
/** 與付款 CustomField / Notify URL 相容的緊湊 payload */
const STORED_VIDEO_PAYLOAD_RE = /^([a-zA-Z0-9_-]{11})@(\d+)$/;
const MAX_YOUTUBE_START_SEC = 6 * 3600; // 6 小時

function clampStartSec(n) {
    if (!Number.isFinite(n) || n < 0) {
        return 0;
    }
    return Math.min(Math.floor(n), MAX_YOUTUBE_START_SEC);
}

/**
 * 解析 t= 參數值本體（不含鍵名），支援 90、90s、1h2m3s 等常見形式
 * @param {string} raw
 * @returns {number}
 */
function parseYoutubeTimeParamValue(raw) {
    const v = decodeURIComponent(String(raw).trim());
    if (!v) {
        return 0;
    }
    if (/^\d+$/.test(v)) {
        return clampStartSec(parseInt(v, 10));
    }
    if (/^\d+s$/i.test(v)) {
        return clampStartSec(parseInt(v, 10));
    }
    let sec = 0;
    const h = v.match(/(\d+)\s*h/i);
    const m = v.match(/(\d+)\s*m/i);
    const sPart = v.match(/(\d+)\s*s/i);
    if (h) {
        sec += parseInt(h[1], 10) * 3600;
    }
    if (m) {
        sec += parseInt(m[1], 10) * 60;
    }
    if (sPart) {
        sec += parseInt(sPart[1], 10);
    }
    if (h || m || sPart) {
        return clampStartSec(sec);
    }
    const lead = v.match(/^(\d+)/);
    if (lead) {
        return clampStartSec(parseInt(lead[1], 10));
    }
    return 0;
}

/**
 * 從完整網址或帶查詢字串的內容解析「從第幾秒開始」（t=、start=）。
 * @param {string} [input]
 * @returns {number}
 */
function parseYoutubeStartSecondsFromInput(input) {
    if (input == null || !String(input).trim()) {
        return 0;
    }
    const s = String(input).trim();
    const tMatch = s.match(/[?#&]t=([^&#]+)/i);
    if (tMatch) {
        return parseYoutubeTimeParamValue(tMatch[1]);
    }
    const startMatch = s.match(/[?#&]start=(\d+)/i);
    if (startMatch) {
        return clampStartSec(parseInt(startMatch[1], 10));
    }
    return 0;
}

/**
 * 從斗內表單的 YouTube 欄位取得 videoId 與起始秒數（可來自網址 ?t=、&t= 等）。
 * @param {string} [input]
 * @returns {{ videoId: string|null, startSec: number }}
 */
function parseYoutubeDonationFromInput(input) {
    if (input == null || !String(input).trim()) {
        return { videoId: null, startSec: 0 };
    }
    const videoId = parseYoutubeVideoIdFromInput(input);
    if (!videoId) {
        return { videoId: null, startSec: 0 };
    }
    const startSec = parseYoutubeStartSecondsFromInput(String(input).trim());
    return { videoId, startSec };
}

/**
 * 寫入金流自訂欄位用（避免超長網址）；有時間軸時為 videoId@秒數
 * @param {string} videoId
 * @param {number} startSec
 * @returns {string}
 */
function encodeYoutubeVideoPayloadForPayment(videoId, startSec) {
    const id = String(videoId).trim();
    const sec = clampStartSec(Number(startSec) || 0);
    if (!YOUTUBE_VIDEO_ID_RE.test(id)) {
        return '';
    }
    return sec > 0 ? `${id}@${sec}` : id;
}

/**
 * @param {string} [input]
 * @returns {string|null}
 */
function parseYoutubeVideoIdFromInput(input) {
    if (input == null || !String(input).trim()) {
        return null;
    }
    const s = String(input).trim();
    if (YOUTUBE_VIDEO_ID_RE.test(s)) {
        return s;
    }
    const urlPatterns = [
        /[?&]v=([a-zA-Z0-9_-]{11})(?:[&\s#]|$)/,
        /youtu\.be\/([a-zA-Z0-9_-]{11})(?:[\s?#]|$)/,
        /youtube\.com\/embed\/([a-zA-Z0-9_-]{11})(?:[\s?#]|$)/,
        /youtube\.com\/shorts\/([a-zA-Z0-9_-]{11})(?:[\s?#]|$)/,
        /youtube\.com\/live\/([a-zA-Z0-9_-]{11})(?:[\s?#]|$)/,
    ];
    for (const re of urlPatterns) {
        const m = s.match(re);
        if (m) {
            return m[1];
        }
    }
    return null;
}

/**
 * 從回調存回的字串還原 videoId 與 startSec（支援緊湊格式、純 id、或完整網址備援）
 * @param {string} payload
 * @returns {{ videoId: string|null, startSec: number }}
 */
function resolveVideoPayloadForTask(payload) {
    const s = String(payload || '').trim();
    if (!s) {
        return { videoId: null, startSec: 0 };
    }
    const compact = s.match(STORED_VIDEO_PAYLOAD_RE);
    if (compact) {
        return {
            videoId: compact[1],
            startSec: clampStartSec(parseInt(compact[2], 10)),
        };
    }
    if (YOUTUBE_VIDEO_ID_RE.test(s)) {
        return { videoId: s, startSec: 0 };
    }
    const videoId = parseYoutubeVideoIdFromInput(s);
    const startSec = videoId ? parseYoutubeStartSecondsFromInput(s) : 0;
    return { videoId, startSec: clampStartSec(startSec) };
}

/**
 * @param {string} payload 11 碼 id、id@startSec、或含 v= / youtu.be 的網址
 * @param {number} cost 實際付款金額（以回調為準）
 * @param {string|null} [sourceUrl]
 * @returns {{ videoId: string, playSec: number, startSec: number, sourceUrl: string|null }|null}
 */
function buildVideoTaskFromVideoIdAndCost(payload, cost, sourceUrl = null) {
    const { videoId, startSec } = resolveVideoPayloadForTask(payload);
    if (!videoId || !YOUTUBE_VIDEO_ID_RE.test(videoId)) {
        return null;
    }
    const playSec = computePlaySecondsFromAmount(cost);
    if (playSec <= 0) {
        return null;
    }
    return {
        videoId,
        playSec,
        startSec: clampStartSec(startSec),
        sourceUrl:
            sourceUrl && String(sourceUrl).trim()
                ? String(sourceUrl).trim()
                : null,
    };
}

/**
 * @param {number|string} amount
 * @returns {number} 可播放秒數；金額不足 30 或非法時為 0
 */
function computePlaySecondsFromAmount(amount) {
    const n = Math.floor(Number(amount));
    if (!Number.isFinite(n) || n < 30) {
        return 0;
    }
    const sec = Math.floor(n / 30) * 5;
    return Math.min(30, Math.max(5, sec));
}

module.exports = {
    YOUTUBE_VIDEO_ID_RE,
    STORED_VIDEO_PAYLOAD_RE,
    MAX_YOUTUBE_START_SEC,
    computePlaySecondsFromAmount,
    parseYoutubeVideoIdFromInput,
    parseYoutubeStartSecondsFromInput,
    parseYoutubeDonationFromInput,
    encodeYoutubeVideoPayloadForPayment,
    resolveVideoPayloadForTask,
    buildVideoTaskFromVideoIdAndCost,
};
