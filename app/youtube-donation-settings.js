import './css/common.css';
import './css/donation-overlay.css';
import './css/donation-overlay-water.css';
import './css/donation-overlay-settings.css';
import './css/youtube-donation-settings.css';
import { buildDonationOverlayPageUrl } from './js/donation-overlay-url.js';
import {
    getStoredYoutubeOverlayVolumePercent,
    setYoutubeOverlayVolumePercent,
} from './js/youtube-overlay-volume.js';
import {
    getTotpToken,
    requireTotpVerification,
} from './js/totp-guard.js';

/** 與斗內通知測試用固定影片一致：https://www.youtube.com/watch?v=3HogDT_HH3I */
const YOUTUBE_VOLUME_TEST_VIDEO_ID = '3HogDT_HH3I';

function loadYoutubeIframeApi() {
    if (window.YT && window.YT.Player) {
        return Promise.resolve();
    }
    return new Promise(resolve => {
        const prev = window.onYouTubeIframeAPIReady;
        window.onYouTubeIframeAPIReady = function () {
            if (typeof prev === 'function') {
                prev();
            }
            resolve();
        };
        const tag = document.createElement('script');
        tag.src = 'https://www.youtube.com/iframe_api';
        document.head.appendChild(tag);
    });
}

function getMerchantId() {
    const params = new URLSearchParams(window.location.search);
    const fromQuery = (params.get('merchantId') || '').trim();
    const fromStorage = (localStorage.getItem('merchantId') || '').trim();
    return fromQuery || fromStorage;
}

function buildAuthHeaders(extra = {}) {
    const headers = { ...extra };
    const token = getTotpToken();
    if (token) {
        headers['X-TOTP-Token'] = token;
    }
    return headers;
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

function setYtDonationMsg(el, text, kind) {
    if (!el) {
        return;
    }
    el.textContent = text || '';
    el.className =
        'yt-donation-msg' +
        (kind === 'ok' ? ' yt-donation-msg--ok' : '') +
        (kind === 'err' ? ' yt-donation-msg--err' : '');
}

async function init() {
    const merchantId = getMerchantId();
    if (!merchantId) {
        window.location.href = '/login.html';
        return;
    }

    const totpOk = await requireTotpVerification(merchantId);
    if (!totpOk) {
        return;
    }

    const enabledEl = document.getElementById('ytDonationEnabled');
    const amtEl = document.getElementById('ytDonationAmount');
    const saveBtn = document.getElementById('btnSaveYtDonation');
    const msgEl = document.getElementById('ytDonationMsg');
    const volumeRange = document.getElementById('donationYoutubeVolume');
    const volumeLabel = document.getElementById('donationYoutubeVolumeLabel');
    const overlayUrlEl = document.getElementById('ytDonationOverlayUrl');
    const copyOverlayBtn = document.getElementById('btnCopyYtDonationOverlayUrl');
    const testPlayBtn = document.getElementById('btnYoutubeVolumeTestPlay');
    const testMountEl = document.getElementById('youtubeVolumeTestMount');

    let youtubeVolumeTestPlayer = null;

    function getVolumePercentFromUi() {
        if (volumeRange) {
            const v = Number.parseInt(volumeRange.value, 10);
            if (!Number.isNaN(v)) {
                return Math.min(100, Math.max(0, v));
            }
        }
        return getStoredYoutubeOverlayVolumePercent();
    }

    function destroyYoutubeVolumeTestPlayer() {
        if (
            youtubeVolumeTestPlayer &&
            typeof youtubeVolumeTestPlayer.destroy === 'function'
        ) {
            try {
                youtubeVolumeTestPlayer.destroy();
            } catch (_) {
                /* ignore */
            }
        }
        youtubeVolumeTestPlayer = null;
        if (testMountEl) {
            testMountEl.innerHTML = '';
        }
    }

    function applyVolumeToYoutubeTestPlayer() {
        if (
            !youtubeVolumeTestPlayer ||
            typeof youtubeVolumeTestPlayer.setVolume !== 'function'
        ) {
            return;
        }
        try {
            youtubeVolumeTestPlayer.setVolume(getVolumePercentFromUi());
        } catch (_) {
            /* ignore */
        }
    }

    async function playYoutubeVolumeTest() {
        if (!testMountEl) {
            return;
        }
        destroyYoutubeVolumeTestPlayer();
        await loadYoutubeIframeApi();

        const innerId = `ytVolTest_${Date.now()}_${Math.random()
            .toString(36)
            .slice(2, 9)}`;
        const host = document.createElement('div');
        host.id = innerId;
        host.className = 'yt-volume-test-player-host';
        testMountEl.appendChild(host);

        const origin =
            window.location.origin ||
            `${window.location.protocol}//${window.location.host}`;

        youtubeVolumeTestPlayer = new window.YT.Player(innerId, {
            videoId: YOUTUBE_VOLUME_TEST_VIDEO_ID,
            width: '100%',
            height: '100%',
            playerVars: {
                autoplay: 1,
                controls: 1,
                rel: 0,
                modestbranding: 1,
                playsinline: 1,
                origin,
            },
            events: {
                onReady: e => {
                    try {
                        const p = getVolumePercentFromUi();
                        e.target.setVolume(p);
                        e.target.playVideo();
                    } catch (_) {
                        /* ignore */
                    }
                },
            },
        });
    }

    function syncVolumeLabel(percent) {
        if (volumeLabel) {
            volumeLabel.textContent = `${percent}%`;
        }
        if (volumeRange) {
            volumeRange.setAttribute('aria-valuenow', String(percent));
        }
    }

    function refreshOverlayUrl() {
        if (overlayUrlEl) {
            overlayUrlEl.value = buildDonationOverlayPageUrl(merchantId);
            overlayUrlEl.placeholder = '';
        }
    }

    try {
        const res = await fetch(
            `/api/v1/comme/ecpay/config/id=${encodeURIComponent(merchantId)}`,
            { headers: buildAuthHeaders() }
        );
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
            throw new Error(data.error || '載入失敗');
        }
        if (enabledEl) {
            enabledEl.checked = data.youtubeDonationEnabled === true;
        }
        if (amtEl && data.youtubeDonationAmount != null) {
            const n = Number(data.youtubeDonationAmount);
            if (Number.isFinite(n) && n >= 1) {
                amtEl.value = String(Math.min(9999, Math.floor(n)));
            }
        }
    } catch (err) {
        setYtDonationMsg(msgEl, err.message || '載入失敗', 'err');
    }

    const vp = getStoredYoutubeOverlayVolumePercent();
    if (volumeRange) {
        volumeRange.value = String(vp);
    }
    syncVolumeLabel(vp);
    refreshOverlayUrl();

    if (volumeRange) {
        volumeRange.addEventListener('input', () => {
            const percent = Number.parseInt(volumeRange.value, 10);
            if (Number.isNaN(percent)) {
                return;
            }
            setYoutubeOverlayVolumePercent(percent);
            syncVolumeLabel(percent);
            refreshOverlayUrl();
            applyVolumeToYoutubeTestPlayer();
        });
    }

    if (testPlayBtn) {
        testPlayBtn.addEventListener('click', () => {
            playYoutubeVolumeTest().catch(() => {
                /* ignore */
            });
        });
    }

    if (copyOverlayBtn && overlayUrlEl) {
        copyOverlayBtn.addEventListener('click', () => {
            if (!overlayUrlEl.value) {
                return;
            }
            copyToClipboard(overlayUrlEl.value, overlayUrlEl, copyOverlayBtn);
        });
    }

    if (saveBtn) {
        saveBtn.addEventListener('click', async () => {
            const enabled = enabledEl ? enabledEl.checked : false;
            const raw = amtEl ? amtEl.value.trim() : '';
            const n = parseInt(raw, 10);
            if (!Number.isFinite(n) || n < 1 || n > 9999) {
                setYtDonationMsg(
                    msgEl,
                    '請輸入有效的每秒金額（1～9999）',
                    'err'
                );
                return;
            }

            async function patchOnce() {
                return fetch(
                    `/api/v1/comme/ecpay/config/id=${encodeURIComponent(merchantId)}`,
                    {
                        method: 'PATCH',
                        headers: buildAuthHeaders({
                            'Content-Type': 'application/json',
                        }),
                        body: JSON.stringify({
                            youtubeDonationEnabled: enabled,
                            youtubeDonationAmount: n,
                        }),
                    }
                );
            }

            setYtDonationMsg(msgEl, '儲存中…', '');
            saveBtn.disabled = true;
            try {
                let res = await patchOnce();
                let result = await res.json().catch(() => ({}));

                if (
                    !res.ok &&
                    res.status === 401 &&
                    (result.error || '').includes('TOTP')
                ) {
                    setYtDonationMsg(
                        msgEl,
                        '請輸入驗證碼以完成儲存…',
                        ''
                    );
                    const again = await requireTotpVerification(merchantId);
                    if (!again) {
                        setYtDonationMsg(msgEl, '已取消', 'err');
                        return;
                    }
                    setYtDonationMsg(msgEl, '儲存中…', '');
                    res = await patchOnce();
                    result = await res.json().catch(() => ({}));
                }

                if (!res.ok) {
                    throw new Error(result.error || '儲存失敗');
                }
                if (enabledEl) {
                    enabledEl.checked = result.youtubeDonationEnabled === true;
                }
                if (amtEl && result.youtubeDonationAmount != null) {
                    const nn = Number(result.youtubeDonationAmount);
                    if (Number.isFinite(nn) && nn >= 1) {
                        amtEl.value = String(Math.min(9999, Math.floor(nn)));
                    }
                }
                setYtDonationMsg(msgEl, '已儲存', 'ok');
                window.setTimeout(() => {
                    if (msgEl && msgEl.textContent === '已儲存') {
                        msgEl.textContent = '';
                        msgEl.className = 'yt-donation-msg';
                    }
                }, 2500);
            } catch (err) {
                setYtDonationMsg(msgEl, err.message || '儲存失敗', 'err');
            } finally {
                saveBtn.disabled = false;
            }
        });
    }
}

document.addEventListener('DOMContentLoaded', init, { once: true });
