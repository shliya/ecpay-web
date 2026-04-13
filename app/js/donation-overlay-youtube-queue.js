/**
 * 依序播放斗內附帶的 YouTube 影片（Iframe API），播畢或錯誤後才處理下一筆。
 */

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

/**
 * @param {HTMLElement} mountEl
 * @param {{ volumePercent?: number }} [options]
 */
export function createDonationYoutubeQueue(mountEl, options = {}) {
    const volumePercent =
        options.volumePercent != null ? Number(options.volumePercent) : 100;
    const queue = [];
    let busy = false;
    let player = null;
    let endTimer = null;
    let hostEl = null;

    function clearTimer() {
        if (endTimer) {
            clearTimeout(endTimer);
            endTimer = null;
        }
    }

    function destroyPlayer() {
        clearTimer();
        if (player && typeof player.destroy === 'function') {
            try {
                player.destroy();
            } catch (_) {
                /* ignore */
            }
        }
        player = null;
        if (hostEl && hostEl.parentNode) {
            hostEl.parentNode.removeChild(hostEl);
        }
        hostEl = null;
    }

    function finishCurrent() {
        queue.shift();
        destroyPlayer();
        busy = false;
        if (queue.length === 0) {
            mountEl.classList.remove('donation-youtube-mount--active');
        }
        runNext();
    }

    function runNext() {
        if (busy || queue.length === 0) {
            return;
        }
        busy = true;
        const task = queue[0];
        const { videoId, playSec, startSec: rawStart } = task;
        if (!videoId || !playSec) {
            finishCurrent();
            return;
        }
        const startSec = Math.max(0, Math.floor(Number(rawStart) || 0));

        const safetyMs = Math.max(Number(playSec) * 1000 + 5000, 8000);

        loadYoutubeIframeApi()
            .then(() => {
                hostEl = document.createElement('div');
                hostEl.className = 'donation-yt-player-host';
                const innerId = `donationYtPlayer_${Date.now()}_${Math.random()
                    .toString(36)
                    .slice(2, 9)}`;
                hostEl.id = innerId;
                mountEl.appendChild(hostEl);
                mountEl.classList.add('donation-youtube-mount--active');

                const origin =
                    window.location.origin ||
                    `${window.location.protocol}//${window.location.host}`;

                player = new window.YT.Player(innerId, {
                    videoId,
                    width: '100%',
                    height: '100%',
                    playerVars: {
                        autoplay: 1,
                        controls: 0,
                        rel: 0,
                        modestbranding: 1,
                        playsinline: 1,
                        origin,
                        ...(startSec > 0 ? { start: startSec } : {}),
                    },
                    events: {
                        onReady: e => {
                            try {
                                if (startSec > 0) {
                                    e.target.seekTo(startSec, true);
                                } else {
                                    e.target.seekTo(0, true);
                                }
                                const vol = Math.min(
                                    100,
                                    Math.max(0, volumePercent)
                                );
                                if (Number.isFinite(vol)) {
                                    e.target.setVolume(vol);
                                }
                                e.target.playVideo();
                            } catch (_) {
                                /* ignore */
                            }
                        },
                        onError: () => {
                            finishCurrent();
                        },
                    },
                });

                endTimer = setTimeout(() => {
                    try {
                        if (player && player.stopVideo) {
                            player.stopVideo();
                        }
                    } catch (_) {
                        /* ignore */
                    }
                    finishCurrent();
                }, safetyMs);
            })
            .catch(() => {
                finishCurrent();
            });
    }

    return {
        /**
         * @param {{ videoId: string, playSec: number, startSec?: number }} videoTask
         */
        enqueue(videoTask) {
            if (!videoTask || !videoTask.videoId || !videoTask.playSec) {
                return;
            }
            queue.push(videoTask);
            runNext();
        },
    };
}
