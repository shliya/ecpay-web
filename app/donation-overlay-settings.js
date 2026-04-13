import './css/common.css';
import './css/donation-overlay.css';
import './css/donation-overlay-water.css';
import './css/donation-overlay-settings.css';
import { showDonationOverlayAlert } from './js/donation-overlay-alert.js';
import {
    getDonationBellVolumePercent,
    playDonationBell,
    setDonationBellVolumePercent,
} from './js/play-donation-bell.js';
import { buildDonationOverlayPageUrl } from './js/donation-overlay-url.js';
import checkTotpBinding from './js/totp-guard.js';

const TEST_DONATION = {
    name: '測試',
    cost: 100,
    message: '測試斗內',
};

function getMerchantId() {
    const params = new URLSearchParams(window.location.search);
    const fromQuery = (params.get('merchantId') || '').trim();
    const fromStorage = (localStorage.getItem('merchantId') || '').trim();
    return fromQuery || fromStorage;
}

function flashButton(btn, text) {
    const orig = btn.textContent;
    btn.textContent = text;
    window.setTimeout(() => {
        btn.textContent = orig;
    }, 1500);
}

function copyToClipboard(text, inputEl, btn) {
    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(
            () => flashButton(btn, '已複製'),
            () => {
                inputEl.select();
                document.execCommand('copy');
                flashButton(btn, '已複製');
            }
        );
    } else {
        inputEl.select();
        if (document.execCommand('copy')) {
            flashButton(btn, '已複製');
        }
    }
}

async function init() {
    const merchantId = getMerchantId();
    if (!merchantId) {
        window.location.href = '/login.html';
        return;
    }

    const totpOk = await checkTotpBinding(merchantId);
    if (!totpOk) {
        return;
    }

    const inputEl = document.getElementById('overlayPageUrl');
    const copyBtn = document.getElementById('btnCopyOverlayUrl');
    const previewBtn = document.getElementById('btnOpenOverlayPreview');

    if (inputEl) {
        inputEl.placeholder = '';
    }

    if (copyBtn && inputEl) {
        copyBtn.addEventListener('click', () => {
            if (!inputEl.value) {
                return;
            }
            copyToClipboard(inputEl.value, inputEl, copyBtn);
        });
    }

    if (previewBtn && inputEl) {
        previewBtn.addEventListener('click', () => {
            const url =
                inputEl.value || buildDonationOverlayPageUrl(getMerchantId());
            if (!url) {
                return;
            }
            window.open(url, '_blank', 'noopener,noreferrer');
        });
    }

    const testBtn = document.getElementById('btnTestDonationOverlay');
    const previewRoot = document.getElementById('donationOverlayPreviewRoot');
    const volumeRange = document.getElementById('donationBellVolume');
    const volumeLabel = document.getElementById('donationBellVolumeLabel');

    function syncVolumeLabel(percent) {
        if (volumeLabel) {
            volumeLabel.textContent = `${percent}%`;
        }
        if (volumeRange) {
            volumeRange.setAttribute('aria-valuenow', String(percent));
        }
    }

    function applyVolumeFromStorage() {
        const percent = getDonationBellVolumePercent();
        if (volumeRange) {
            volumeRange.value = String(percent);
        }
        syncVolumeLabel(percent);
    }

    if (volumeRange) {
        applyVolumeFromStorage();
        volumeRange.addEventListener('input', () => {
            const percent = Number.parseInt(volumeRange.value, 10);
            if (Number.isNaN(percent)) {
                return;
            }
            setDonationBellVolumePercent(percent);
            syncVolumeLabel(percent);
            if (inputEl) {
                inputEl.value = buildDonationOverlayPageUrl(getMerchantId());
            }
        });
    }

    if (inputEl) {
        inputEl.value = buildDonationOverlayPageUrl(getMerchantId());
    }

    if (testBtn && previewRoot) {
        testBtn.addEventListener('click', () => {
            playDonationBell();
            showDonationOverlayAlert(previewRoot, {
                name: TEST_DONATION.name,
                cost: TEST_DONATION.cost,
                message: TEST_DONATION.message,
            });
        });
    }
}

document.addEventListener('DOMContentLoaded', init, { once: true });
