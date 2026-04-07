import './css/donation-overlay.css';
import './css/donation-overlay-water.css';
import './css/donation-overlay-youtube.css';
import ActiveStatusKeeper from './js/active-keeper.js';
import {
    showDonationOverlayAlert,
    DONATION_OVERLAY_ALERT_MS,
} from './js/donation-overlay-alert.js';
import {
    initDonationBellVolumeFromUrl,
    isDonationBellAudioUnlocked,
    playDonationBell,
    unlockDonationBellAudio,
} from './js/play-donation-bell.js';
import { createDonationYoutubeQueue } from './js/donation-overlay-youtube-queue.js';

/** 與 donation-overlay-youtube-queue.js 的 safetyMs 一致，讓文字覆蓋層與影片切段對齊 */
function videoTaskOverlayHoldMs(playSec) {
    const sec = Number(playSec);
    if (!Number.isFinite(sec) || sec <= 0) {
        return DONATION_OVERLAY_ALERT_MS;
    }
    return Math.max(sec * 1000 + 5000, 8000);
}

function getQueryParam(name) {
    const url = new URL(window.location.href);
    return url.searchParams.get(name);
}

function showMissingMerchant(rootEl) {
    rootEl.innerHTML = '';
    rootEl.className = 'donation-overlay-empty';
    rootEl.textContent =
        '請在網址加上 ?merchantId=你的特店代號（例如 donation-overlay.html?merchantId=xxx）';
}

function getOverlayElements(rootEl) {
    const stage =
        document.getElementById('donationOverlayStage') ||
        document.getElementById('appRoot');
    const ytMount =
        document.getElementById('donationYoutubeMount') ||
        document.getElementById('appRoot');
    return { stage: stage || rootEl, ytMount: ytMount || rootEl };
}

function init() {
    const rootEl = document.getElementById('appRoot');
    if (!rootEl) {
        return;
    }

    const merchantId = getQueryParam('merchantId');
    if (!merchantId || !merchantId.trim()) {
        showMissingMerchant(rootEl);
        return;
    }

    const id = merchantId.trim();

    initDonationBellVolumeFromUrl(new URL(window.location.href).searchParams);

    installDonationOverlayAudioUnlock();

    const { stage: stageEl, ytMount: ytMountEl } = getOverlayElements(rootEl);
    const ytQueue = createDonationYoutubeQueue(ytMountEl);

    const activeKeeper = new ActiveStatusKeeper(id, 3001, {
        onMessage(msg) {
            if (msg.type !== 'new-donation') {
                return;
            }
            playDonationBell();
            const vt = msg.videoTask;
            const visibleMs =
                vt && vt.playSec
                    ? Math.max(
                          DONATION_OVERLAY_ALERT_MS,
                          videoTaskOverlayHoldMs(vt.playSec)
                      )
                    : undefined;
            showDonationOverlayAlert(stageEl, {
                name: msg.name,
                cost: msg.cost,
                message: msg.message,
                visibleMs,
            });
            if (vt) {
                ytQueue.enqueue(vt);
            }
        },
    });
    activeKeeper.connect();

    window.addEventListener('beforeunload', () => {
        activeKeeper.disconnect();
    });
}

function installDonationOverlayAudioUnlock() {
    if (isDonationBellAudioUnlocked()) {
        return;
    }

    const wrap = document.createElement('div');
    wrap.className = 'donation-overlay-audio-hint';
    wrap.setAttribute('role', 'button');
    wrap.setAttribute('tabindex', '0');
    document.body.appendChild(wrap);

    let unlocking = false;

    const tryUnlock = () => {
        if (isDonationBellAudioUnlocked()) {
            wrap.remove();
            return;
        }
        if (unlocking) {
            return;
        }
        unlocking = true;
        unlockDonationBellAudio()
            .then(() => {
                wrap.remove();
            })
            .catch(() => {
                const inner = wrap.querySelector(
                    '.donation-overlay-audio-hint-inner'
                );
                if (inner) {
                    inner.innerHTML =
                        '仍無法播放，請確認 OBS 該瀏覽器來源已勾選「透過 OBS 控制音訊」後再點一次';
                }
            })
            .finally(() => {
                unlocking = false;
            });
    };

    wrap.addEventListener('pointerdown', tryUnlock);
    wrap.addEventListener('keydown', e => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            tryUnlock();
        }
    });
}

document.addEventListener('DOMContentLoaded', init, { once: true });
