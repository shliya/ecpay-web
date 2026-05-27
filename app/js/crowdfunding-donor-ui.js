export function isNonEmptyString(v) {
    return typeof v === 'string' && v.trim().length > 0;
}

export function formatMoney(n) {
    const num = Number(n);
    if (!Number.isFinite(num) || num < 0) return '$0';
    return '$' + Math.floor(num).toLocaleString('zh-TW');
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

        const name = document.createElement('span');
        name.className = 'cf-donor-name';
        name.textContent =
            isNonEmptyString(d.name) ? d.name.trim() : '匿名';
        const amount = document.createElement('span');
        amount.className = 'cf-donor-amount';
        amount.textContent = formatMoney(d.amount);
        li.appendChild(tier);
        li.appendChild(name);
        li.appendChild(amount);
        listEl.appendChild(li);
    });
}
