import './css/donation-overlay.css';
import './css/donation-overlay-water.css';
import ActiveStatusKeeper from './js/active-keeper.js';
import { showDonationOverlayAlert } from './js/donation-overlay-alert.js';
import {
    initDonationBellVolumeFromUrl,
    isDonationBellAudioUnlocked,
    playDonationBell,
    unlockDonationBellAudio,
} from './js/play-donation-bell.js';

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

    const activeKeeper = new ActiveStatusKeeper(id, 3001, {
        onMessage(msg) {
            if (msg.type !== 'new-donation') {
                return;
            }
            playDonationBell();
            showDonationOverlayAlert(rootEl, {
                name: msg.name,
                cost: msg.cost,
                message: msg.message,
            });
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
    wrap.innerHTML =
        '<div class="donation-overlay-audio-hint-inner">請點擊此處或畫面任意處以啟用提示音<br /><kbd>瀏覽器／OBS 需一次點擊才允許播放音效</kbd></div>';
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
