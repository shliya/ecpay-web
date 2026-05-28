export function isNonEmptyString(v) {
    return typeof v === 'string' && v.trim().length > 0;
}

export function formatMoney(n) {
    const num = Number(n);
    if (!Number.isFinite(num) || num < 0) return '$0';
    return '$' + Math.floor(num).toLocaleString('zh-TW');
}

/**
 * @param {string} label
 * @returns {HTMLSpanElement}
 */
export function createDonorNameElement(label) {
    const nameRoot = document.createElement('span');
    nameRoot.className = 'cf-donor-name';
    const track = document.createElement('span');
    track.className = 'cf-donor-name__track';
    const text = document.createElement('span');
    text.className = 'cf-donor-name__text';
    text.textContent = label;
    track.appendChild(text);
    nameRoot.appendChild(track);
    return nameRoot;
}

/** 滾動終點多移一點，避免最後一字被裁切 */
const DONOR_NAME_SCROLL_END_PAD_PX = 10;

/**
 * @param {HTMLElement} track
 * @param {HTMLElement} text
 * @returns {number}
 */
function measureDonorNameScrollDistance(track, text) {
    const trackWidth = track.getBoundingClientRect().width;
    if (trackWidth <= 0) {
        return 0;
    }

    const style = text.style;
    const prevTransform = style.transform;
    const prevMaxWidth = style.maxWidth;
    style.transform = 'none';
    style.maxWidth = 'none';

    const textWidth = Math.ceil(
        Math.max(text.scrollWidth, text.getBoundingClientRect().width)
    );

    style.transform = prevTransform;
    style.maxWidth = prevMaxWidth;

    const overflow = textWidth - trackWidth;
    if (overflow <= 0.5) {
        return 0;
    }
    return overflow + DONOR_NAME_SCROLL_END_PAD_PX;
}

/**
 * 名稱超出欄寬時啟用左右滾動。
 * @param {HTMLElement} nameRoot
 */
export function setupDonorNameScroll(nameRoot) {
    const track = nameRoot && nameRoot.querySelector('.cf-donor-name__track');
    const text = nameRoot && nameRoot.querySelector('.cf-donor-name__text');
    if (!track || !text) {
        return;
    }

    const apply = function () {
        nameRoot.classList.remove('is-scroll');
        text.style.removeProperty('--cf-scroll-distance');
        text.style.removeProperty('--cf-scroll-duration');

        const distance = measureDonorNameScrollDistance(track, text);
        if (distance <= 0) {
            return;
        }

        nameRoot.classList.add('is-scroll');
        text.style.setProperty('--cf-scroll-distance', distance + 'px');
        const seconds = Math.max(3, Math.min(16, distance / 22));
        text.style.setProperty('--cf-scroll-duration', seconds + 's');
    };

    requestAnimationFrame(function () {
        requestAnimationFrame(apply);
    });
}

/**
 * @param {HTMLElement} listEl
 */
export function setupDonorListNameScroll(listEl) {
    if (!listEl) {
        return;
    }
    const run = function () {
        listEl.querySelectorAll('.cf-donor-name').forEach(setupDonorNameScroll);
    };
    run();
    requestAnimationFrame(function () {
        requestAnimationFrame(run);
    });
    if (typeof document !== 'undefined' && document.fonts && document.fonts.ready) {
        document.fonts.ready.then(run).catch(function () {});
    }
}

export function resolveDonorTierIconUrl(icons, listIndex) {
    if (!icons || typeof icons !== 'object') {
        return null;
    }
    if (isNonEmptyString(icons.icon)) {
        return icons.icon.trim();
    }
    const rank = listIndex + 1;
    let key = 'other';
    if (rank === 1) key = 'rank1';
    else if (rank === 2) key = 'rank2';
    else if (rank === 3) key = 'rank3';
    const url = icons[key];
    return isNonEmptyString(url) ? url.trim() : null;
}

/**
 * @param {HTMLElement} listEl
 * @param {object} pageData
 * @param {Array<{ name: string, amount: number }>} donors
 * @param {{ emptyText?: string, itemClass?: string, rankOffset?: number, tierIconUrl?: string }} [options]
 */
export function renderDonorList(listEl, pageData, donors, options) {
    if (!listEl) {
        return;
    }
    const opts = options || {};
    const emptyText = opts.emptyText || '尚無斗內紀錄';
    const itemClass = opts.itemClass || 'cf-donor-item';
    const rankOffset = Math.max(0, Number(opts.rankOffset) || 0);

    listEl.innerHTML = '';
    const donorList = Array.isArray(donors) ? donors : [];
    if (donorList.length === 0) {
        const li = document.createElement('li');
        li.className = 'cf-donor-empty';
        li.textContent = emptyText;
        listEl.appendChild(li);
        return;
    }

    let tierIcons =
        opts.tierIcons != null
            ? opts.tierIcons
            : pageData && pageData.donorTierIcons;
    if (isNonEmptyString(opts.tierIconUrl)) {
        tierIcons = { icon: opts.tierIconUrl.trim() };
    }

    donorList.forEach(function (d, index) {
        const li = document.createElement('li');
        li.className = itemClass;
        const tier = document.createElement('span');
        tier.className = 'cf-donor-tier';
        tier.setAttribute('aria-hidden', 'true');

        const iconUrl = resolveDonorTierIconUrl(tierIcons, index + rankOffset);
        if (iconUrl) {
            const img = document.createElement('img');
            img.className = 'cf-donor-tier-img';
            img.src = iconUrl;
            img.alt = '';
            img.loading = 'lazy';
            tier.appendChild(img);
            tier.classList.add('has-image');
        } else {
            tier.classList.add('cf-donor-tier--fallback');
        }

        const displayName =
            isNonEmptyString(d.name) ? d.name.trim() : '匿名';
        const name = createDonorNameElement(displayName);
        const amount = document.createElement('span');
        amount.className = 'cf-donor-amount';
        amount.textContent = formatMoney(d.amount);
        const detail = document.createElement('div');
        detail.className = 'cf-donor-detail';
        detail.appendChild(name);
        detail.appendChild(amount);
        li.appendChild(tier);
        li.appendChild(detail);
        listEl.appendChild(li);
    });

    setupDonorListNameScroll(listEl);
}
