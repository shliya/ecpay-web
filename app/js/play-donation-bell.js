import bellUrl from '../assest/bell.mp3';

const DONATION_BELL_VOLUME_KEY = 'donationBellVolume';

let bellAudio = null;
let unlocked = false;
let volumeFromOverlayUrl = false;
let overlayUrlVolumePercent = 100;

function parseStoredVolumePercent() {
    const raw = localStorage.getItem(DONATION_BELL_VOLUME_KEY);
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
 * 僅斗內通知頁（OBS）在載入時呼叫一次。音量以網址 `volume` 為準（0～100），不依賴 localStorage。
 * @param {URLSearchParams} searchParams
 */
export function initDonationBellVolumeFromUrl(searchParams) {
    volumeFromOverlayUrl = true;
    const raw = searchParams.get('volume');
    if (raw === null || raw === '') {
        overlayUrlVolumePercent = 100;
        return;
    }
    const n = Number.parseInt(raw, 10);
    overlayUrlVolumePercent = Number.isNaN(n)
        ? 100
        : Math.min(100, Math.max(0, n));
}

/**
 * @returns {number} 0～1，供 HTMLAudioElement.volume 使用
 */
export function getDonationBellVolume() {
    if (volumeFromOverlayUrl) {
        return overlayUrlVolumePercent / 100;
    }
    return parseStoredVolumePercent() / 100;
}

/**
 * @returns {number} 0～100（設定頁：localStorage；OBS overlay：與網址 `volume` 一致）
 */
export function getDonationBellVolumePercent() {
    if (volumeFromOverlayUrl) {
        return overlayUrlVolumePercent;
    }
    return parseStoredVolumePercent();
}

/**
 * @param {number} percent 0～100
 */
export function setDonationBellVolumePercent(percent) {
    const n = Number(percent);
    const clamped = Math.min(
        100,
        Math.max(0, Math.round(Number.isNaN(n) ? 100 : n))
    );
    localStorage.setItem(DONATION_BELL_VOLUME_KEY, String(clamped));
}

export function isDonationBellAudioUnlocked() {
    return unlocked;
}

/**
 * 需在使用者點擊等手勢後呼叫一次，解除瀏覽器自動播放限制（OBS 內嵌亦同）。
 * @returns {Promise<void>}
 */
export function unlockDonationBellAudio() {
    return new Promise((resolve, reject) => {
        try {
            if (!bellAudio) {
                bellAudio = new Audio(bellUrl);
                bellAudio.preload = 'auto';
            }
            bellAudio.volume = 0.02;
            bellAudio.currentTime = 0;
            const playResult = bellAudio.play();
            if (playResult && typeof playResult.then === 'function') {
                playResult
                    .then(() => {
                        bellAudio.pause();
                        bellAudio.currentTime = 0;
                        bellAudio.volume = getDonationBellVolume();
                        unlocked = true;
                        resolve();
                    })
                    .catch(reject);
            } else {
                unlocked = true;
                resolve();
            }
        } catch (e) {
            reject(e);
        }
    });
}

export function playDonationBell() {
    try {
        if (!bellAudio) {
            bellAudio = new Audio(bellUrl);
            bellAudio.preload = 'auto';
        }
        bellAudio.volume = getDonationBellVolume();
        bellAudio.currentTime = 0;
        const playResult = bellAudio.play();
        if (playResult && typeof playResult.catch === 'function') {
            playResult.catch(err => {
                console.warn(
                    'playDonationBell: 無法播放（若為首次使用請先點擊畫面啟用音效）',
                    err
                );
            });
        }
    } catch (e) {
        console.warn('playDonationBell failed', e);
    }
}
