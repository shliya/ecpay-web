import bellUrl from '../assest/bell.mp3';

let bellAudio = null;
let unlocked = false;

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
                        bellAudio.volume = 1;
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
        bellAudio.volume = 1;
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
