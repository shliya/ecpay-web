/**
 * 觀眾斗內頁 themeColors 欄位（與 viewer-donate.css 的 CSS 變數對應）
 */
export const donateThemeDefaults = {
    bg: '#cfe3ff',
    windowBg: '#ffffff',
    border: '#1e355c',
    borderLight: '#7fa6e8',
    text: '#1e355c',
    inputBg: '#eef4ff',
    btnBg: '#4a90a4',
    btnBorder: '#2d5f6f',
    btnText: '#ffffff',
    payuniBg: '#5b7c99',
    payuniBorder: '#3d5a6e',
    payuniText: '#ffffff',
    opayBg: '#2d7a5e',
    opayBorder: '#1d5a43',
    opayText: '#ffffff',
    activeBg: '#1e355c',
    activeText: '#ffffff',
    link: '#1e355c',
    linkMuted: '#999999',
    error: '#cc0000',
};

/** @type {Record<string, string>} */
export const donateThemeVarMap = {
    bg: '--donate-bg',
    windowBg: '--donate-window-bg',
    border: '--donate-border',
    borderLight: '--donate-border-light',
    text: '--donate-text',
    inputBg: '--donate-input-bg',
    btnBg: '--donate-btn-bg',
    btnBorder: '--donate-btn-border',
    btnText: '--donate-btn-text',
    payuniBg: '--donate-payuni-bg',
    payuniBorder: '--donate-payuni-border',
    payuniText: '--donate-payuni-text',
    opayBg: '--donate-opay-bg',
    opayBorder: '--donate-opay-border',
    opayText: '--donate-opay-text',
    activeBg: '--donate-quick-active-bg',
    activeText: '--donate-quick-active-text',
    link: '--donate-link',
    linkMuted: '--donate-link-muted',
    error: '--donate-error',
};

/** @type {Array<{ key: string, label: string, section?: string }>} */
export const donateThemeFormFields = [
    { key: 'bg', label: '頁面背景', section: '頁面與區塊' },
    { key: 'windowBg', label: '白底區塊' },
    { key: 'border', label: '主邊框' },
    { key: 'borderLight', label: '淺邊框／陰影' },
    { key: 'text', label: '文字' },
    { key: 'inputBg', label: '輸入框背景' },
    { key: 'activeBg', label: '快速金額選中背景' },
    { key: 'activeText', label: '快速金額選中文字' },
    { key: 'link', label: '連結' },
    { key: 'linkMuted', label: '連結次要' },
    { key: 'error', label: '錯誤訊息' },
    { key: 'btnBg', label: '背景', section: '綠界按鈕' },
    { key: 'btnBorder', label: '邊框' },
    { key: 'btnText', label: '文字' },
    { key: 'payuniBg', label: '背景', section: 'PAYUNi 按鈕' },
    { key: 'payuniBorder', label: '邊框' },
    { key: 'payuniText', label: '文字' },
    { key: 'opayBg', label: '背景', section: '歐付寶按鈕' },
    { key: 'opayBorder', label: '邊框' },
    { key: 'opayText', label: '文字' },
];

/**
 * @param {object} theme
 * @param {HTMLElement|Document} target
 */
export function applyDonateTheme(theme, target) {
    const el = target || document.documentElement;
    const t = theme || {};
    Object.keys(donateThemeVarMap).forEach(function (key) {
        const value = t[key] || donateThemeDefaults[key];
        if (value) {
            el.style.setProperty(donateThemeVarMap[key], value);
        }
    });
}
