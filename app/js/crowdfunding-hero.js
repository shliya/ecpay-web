import { isNonEmptyString } from './crowdfunding-donor-ui.js';

export const CF_MOBILE_MQ = '(max-width: 900px)';

let heroResizeTimer = null;

export function isCfMobileLayout() {
    return window.matchMedia(CF_MOBILE_MQ).matches;
}

export function clearHeroDisplaySize(img) {
    if (!img) {
        return;
    }
    img.style.removeProperty('width');
    img.style.removeProperty('height');
}

export function fitHeroImageToAvailableSlot(img) {
    if (isCfMobileLayout()) {
        clearHeroDisplaySize(img);
        return;
    }
    const frame = document.getElementById('heroFrame');
    const wrap = frame && frame.closest('.cf-hero-wrap');
    if (!img || !frame || !wrap || !frame.classList.contains('has-hero')) {
        return;
    }
    if (!img.naturalWidth || !img.naturalHeight) {
        return;
    }

    const maxH = wrap.clientHeight;
    if (!maxH || maxH < 48) {
        return;
    }

    const wrapStyle = getComputedStyle(wrap);
    let maxW = parseFloat(wrapStyle.maxWidth);
    if (!Number.isFinite(maxW) || maxW <= 0) {
        maxW = wrap.clientWidth || 800;
    }

    const scale = Math.min(
        maxW / img.naturalWidth,
        maxH / img.naturalHeight
    );
    if (!Number.isFinite(scale) || scale <= 0) {
        return;
    }

    img.style.width = Math.round(img.naturalWidth * scale) + 'px';
    img.style.height = Math.round(img.naturalHeight * scale) + 'px';
}

function setHeroFrameState(frame, hasHero) {
    if (!frame) return;
    frame.classList.toggle('has-hero', hasHero);
}

function applyHeroFloatAnimation(img) {
    if (!img) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        img.classList.remove('is-floating');
        img.style.removeProperty('--cf-hero-float-dur');
        img.style.removeProperty('--cf-hero-float-delay');
        return;
    }
    const dur = (5.5 + Math.random() * 4).toFixed(2) + 's';
    const delay = (Math.random() * 2.5).toFixed(2) + 's';
    img.style.setProperty('--cf-hero-float-dur', dur);
    img.style.setProperty('--cf-hero-float-delay', delay);
    img.classList.add('is-floating');
}

function clearHeroFloatAnimation(img) {
    if (!img) return;
    img.classList.remove('is-floating');
    img.style.removeProperty('--cf-hero-float-dur');
    img.style.removeProperty('--cf-hero-float-delay');
}

/** 與主頁相同的主視覺渲染（#heroFrame / #heroImg / #heroPlaceholder） */
export function renderCrowdfundingHero(data) {
    const frame = document.getElementById('heroFrame');
    const img = document.getElementById('heroImg');
    const ph = document.getElementById('heroPlaceholder');
    if (!frame || !img || !ph) return;

    img.onload = null;
    img.onerror = null;

    if (!isNonEmptyString(data.heroImageUrl)) {
        img.removeAttribute('src');
        img.alt = '';
        frame.style.removeProperty('--cf-hero-ratio');
        clearHeroDisplaySize(img);
        clearHeroFloatAnimation(img);
        if (ph) ph.textContent = '主視覺圖尚未設定';
        setHeroFrameState(frame, false);
        return;
    }

    const url = data.heroImageUrl.trim();
    if (ph) ph.textContent = '主視覺圖尚未設定';
    img.alt = isNonEmptyString(data.title) ? data.title.trim() : '主視覺';
    setHeroFrameState(frame, false);

    img.onload = function () {
        if (img.naturalWidth > 0 && img.naturalHeight > 0) {
            frame.style.setProperty(
                '--cf-hero-ratio',
                img.naturalWidth + ' / ' + img.naturalHeight
            );
        }
        setHeroFrameState(frame, true);
        requestAnimationFrame(function () {
            fitHeroImageToAvailableSlot(img);
            applyHeroFloatAnimation(img);
        });
    };
    img.onerror = function () {
        img.removeAttribute('src');
        frame.style.removeProperty('--cf-hero-ratio');
        clearHeroDisplaySize(img);
        clearHeroFloatAnimation(img);
        setHeroFrameState(frame, false);
        if (ph) {
            ph.textContent = '主視覺圖載入失敗';
        }
    };

    if (img.src === url && img.complete && img.naturalWidth > 0) {
        img.onload();
    } else {
        img.src = url;
    }
}

export function bindCrowdfundingHeroResize() {
    window.addEventListener('resize', function () {
        clearTimeout(heroResizeTimer);
        heroResizeTimer = setTimeout(function () {
            const heroImg = document.getElementById('heroImg');
            if (heroImg && heroImg.complete && heroImg.naturalWidth > 0) {
                fitHeroImageToAvailableSlot(heroImg);
            }
        }, 120);
    });
}
