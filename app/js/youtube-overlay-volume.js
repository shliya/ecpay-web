const DONATION_YOUTUBE_VOLUME_KEY = 'donationYoutubeVolume';

let volumeFromOverlayUrl = false;
let overlayUrlYoutubeVolumePercent = 100;

function parseStoredVolumePercent() {
    const raw = localStorage.getItem(DONATION_YOUTUBE_VOLUME_KEY);
    if (raw === null || raw === '') {
        return 100;
    }
    const n = Number.parseInt(raw, 10);
    if (Number.isNaN(n)) {
        return 100;
    }
    return Math.min(100, Math.max(0, n));
}

/**
 * 斗內通知頁載入時呼叫。YouTube 播放器音量以網址 `youtubeVolume` 為準（0～100）。
 * @param {URLSearchParams} searchParams
 */
export function initYoutubeOverlayVolumeFromUrl(searchParams) {
    volumeFromOverlayUrl = true;
    const raw = searchParams.get('youtubeVolume');
    if (raw === null || raw === '') {
        overlayUrlYoutubeVolumePercent = 100;
        return;
    }
    const n = Number.parseInt(raw, 10);
    overlayUrlYoutubeVolumePercent = Number.isNaN(n)
        ? 100
        : Math.min(100, Math.max(0, n));
}

/**
 * @returns {number} 0～100（設定頁：localStorage；overlay：與網址一致）
 */
export function getYoutubeOverlayVolumePercent() {
    if (volumeFromOverlayUrl) {
        return overlayUrlYoutubeVolumePercent;
    }
    return parseStoredVolumePercent();
}

/**
 * 組 OBS 網址時使用（不依賴是否為 overlay 頁）。
 * @returns {number} 0～100
 */
export function getStoredYoutubeOverlayVolumePercent() {
    return parseStoredVolumePercent();
}

/**
 * @param {number} percent 0～100
 */
export function setYoutubeOverlayVolumePercent(percent) {
    const n = Number(percent);
    const clamped = Math.min(
        100,
        Math.max(0, Math.round(Number.isNaN(n) ? 100 : n))
    );
    localStorage.setItem(DONATION_YOUTUBE_VOLUME_KEY, String(clamped));
}
