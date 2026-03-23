const ALERT_MS = 12000;

function formatAmountTwd(cost) {
    const n = parseInt(cost, 10) || 0;
    return new Intl.NumberFormat('zh-TW', {
        style: 'currency',
        currency: 'TWD',
        minimumFractionDigits: 0,
    }).format(n);
}

function buildUserLines(name, message) {
    const lines = [];
    const n = name && String(name).trim() ? String(name).trim() : '匿名';
    lines.push(n);
    lines.push(
        message && String(message).trim()
            ? String(message).trim()
            : '（無留言）'
    );
    return lines.join('\n');
}

/**
 * 在 rootEl 內顯示斗內通知（drank-water 風格：透明底 + 圖片區 + 兩段文字）。
 * @param {HTMLElement} rootEl
 * @param {{ name?: string, cost?: number, message?: string, imageUrl?: string }} payload
 */
export function showDonationOverlayAlert(
    rootEl,
    { name, cost, message, imageUrl }
) {
    rootEl.innerHTML = '';
    rootEl.classList.add(
        'donation-overlay-root',
        'donation-overlay-root--water'
    );

    const stage = document.createElement('div');
    stage.className = 'donation-water-stage';

    const wrap = document.createElement('div');
    wrap.className = 'donation-water-wrap';
    wrap.id = 'wrap';

    const rowImg = document.createElement('div');
    rowImg.className = 'donation-water-row-image';

    const divImage = document.createElement('div');
    divImage.className = 'donation-water-image';
    divImage.id = 'divImage';
    if (imageUrl && String(imageUrl).trim()) {
        const raw = String(imageUrl).trim();
        divImage.style.backgroundImage = `url(${JSON.stringify(raw)})`;
    }

    rowImg.appendChild(divImage);

    const rowText = document.createElement('div');
    rowText.className = 'donation-water-row-text';

    const divAlertMsg = document.createElement('div');
    divAlertMsg.className = 'donation-water-alert-msg';
    divAlertMsg.id = 'divAlertMsg';
    divAlertMsg.textContent = formatAmountTwd(cost);

    const divUserMsg = document.createElement('div');
    divUserMsg.className = 'donation-water-user-msg';
    divUserMsg.id = 'divUserMsg';
    divUserMsg.textContent = buildUserLines(name, message);

    rowText.appendChild(divAlertMsg);
    rowText.appendChild(divUserMsg);

    wrap.appendChild(rowImg);
    wrap.appendChild(rowText);

    stage.appendChild(wrap);

    const attr = document.createElement('div');
    attr.className = 'donation-overlay-attribution';
    attr.innerHTML =
        'Sound: <a href="https://freesound.org/people/JustInvoke/sounds/446111/" target="_blank" rel="noopener noreferrer">Success Jingle</a> by ' +
        '<a href="https://freesound.org/people/JustInvoke/" target="_blank" rel="noopener noreferrer">JustInvoke</a> · ' +
        '<a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noopener noreferrer">CC BY 4.0</a>';

    rootEl.appendChild(stage);
    rootEl.appendChild(attr);

    requestAnimationFrame(() => {
        stage.classList.add('is-visible');
    });

    window.setTimeout(() => {
        stage.classList.remove('is-visible');
        window.setTimeout(() => {
            rootEl.innerHTML = '';
            rootEl.classList.remove(
                'donation-overlay-root',
                'donation-overlay-root--water'
            );
        }, 400);
    }, ALERT_MS);
}

export const DONATION_OVERLAY_ALERT_MS = ALERT_MS;
