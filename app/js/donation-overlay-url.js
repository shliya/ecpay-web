import { getDonationBellVolumePercent } from './play-donation-bell.js';
import { getStoredYoutubeOverlayVolumePercent } from './youtube-overlay-volume.js';

/**
 * 產生 OBS「斗內通知」瀏覽器來源網址（含提示音 volume 與 YouTube 影片 youtubeVolume）。
 * @param {string} merchantId
 * @returns {string}
 */
export function buildDonationOverlayPageUrl(merchantId) {
    if (!merchantId || !String(merchantId).trim()) {
        return '';
    }
    const path = window.location.pathname.replace(/[^/]*$/, '');
    const mid = encodeURIComponent(String(merchantId).trim());
    const bellVol = getDonationBellVolumePercent();
    const ytVol = getStoredYoutubeOverlayVolumePercent();
    return `${window.location.origin}${path}donation-overlay.html?merchantId=${mid}&volume=${encodeURIComponent(String(bellVol))}&youtubeVolume=${encodeURIComponent(String(ytVol))}`;
}
