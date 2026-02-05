import './css/common.css';
import './css/donate-theme.css';

(function () {
    var themeKeys = [
        { key: 'bg', label: '頁面背景' },
        { key: 'windowBg', label: '白底區塊' },
        { key: 'border', label: '主邊框' },
        { key: 'borderLight', label: '淺邊框/陰影' },
        { key: 'text', label: '文字' },
        { key: 'inputBg', label: '輸入框背景' },
        { key: 'btnBg', label: '按鈕背景' },
        { key: 'btnBorder', label: '按鈕邊框' },
        { key: 'btnText', label: '按鈕文字' },
        { key: 'activeBg', label: '快速金額選中背景' },
        { key: 'activeText', label: '快速金額選中文字' },
        { key: 'link', label: '連結' },
        { key: 'linkMuted', label: '連結次要' },
        { key: 'error', label: '錯誤訊息' },
    ];

    var defaultTheme = {
        bg: '#cfe3ff',
        windowBg: '#ffffff',
        border: '#1e355c',
        borderLight: '#7fa6e8',
        text: '#1e355c',
        inputBg: '#eef4ff',
        btnBg: '#4a90a4',
        btnBorder: '#2d5f6f',
        btnText: '#fff',
        activeBg: '#1e355c',
        activeText: '#ffffff',
        link: '#1e355c',
        linkMuted: '#999',
        error: '#c00',
    };

    var varMap = {
        bg: '--donate-bg',
        windowBg: '--donate-window-bg',
        border: '--donate-border',
        borderLight: '--donate-border-light',
        text: '--donate-text',
        inputBg: '--donate-input-bg',
        btnBg: '--donate-btn-bg',
        btnBorder: '--donate-btn-border',
        btnText: '--donate-btn-text',
        activeBg: '--donate-quick-active-bg',
        activeText: '--donate-quick-active-text',
        link: '--donate-link',
        linkMuted: '--donate-link-muted',
        error: '--donate-error',
    };

    function getMerchantId() {
        var p = new URLSearchParams(window.location.search);
        return (
            (p.get('merchantId') || '').trim() ||
            (localStorage.getItem('merchantId') || '').trim()
        );
    }

    function showMessage(msg, type) {
        var el = document.getElementById('themeMessage');
        if (!el) return;
        el.textContent = msg || '';
        el.className = 'theme-message' + (type ? ' ' + type : '');
    }

    function hexToInputColor(hex) {
        if (!hex || typeof hex !== 'string') return '#000000';
        hex = hex.replace(/^#/, '');
        if (hex.length === 3) {
            hex = hex[0] + hex[0] + hex[1] + hex[1] + hex[2] + hex[2];
        }
        return hex.length === 6 ? '#' + hex : '#000000';
    }

    function applyThemeToPreview(theme) {
        var wrapper = document.getElementById('previewWrapper');
        if (!wrapper) return;
        var t = theme || defaultTheme;
        Object.keys(varMap).forEach(function (key) {
            if (t[key]) wrapper.style.setProperty(varMap[key], t[key]);
        });
    }

    function getCurrentTheme() {
        var theme = {};
        themeKeys.forEach(function (item) {
            var hexEl = document.getElementById('theme_' + item.key);
            if (hexEl && hexEl.value) theme[item.key] = hexEl.value.trim();
        });
        return theme;
    }

    function buildForm(currentTheme) {
        var container = document.getElementById('themeFields');
        if (!container) return;
        container.innerHTML = '';
        var t = currentTheme || defaultTheme;
        themeKeys.forEach(function (item) {
            var value = t[item.key] || defaultTheme[item.key] || '#000';
            var row = document.createElement('div');
            row.className = 'theme-row';
            var label = document.createElement('label');
            label.textContent = item.label;
            label.htmlFor = 'theme_' + item.key;
            var colorInput = document.createElement('input');
            colorInput.type = 'color';
            colorInput.id = 'color_' + item.key;
            colorInput.value = hexToInputColor(value);
            colorInput.setAttribute('aria-label', item.label);
            var hexInput = document.createElement('input');
            hexInput.type = 'text';
            hexInput.id = 'theme_' + item.key;
            hexInput.placeholder = '#hex';
            hexInput.value = value;
            hexInput.setAttribute('aria-label', item.label + ' hex');

            function updatePreview() {
                var hex = hexInput.value.trim();
                if (hex && !hex.startsWith('#')) hex = '#' + hex;
                if (hex) colorInput.value = hexToInputColor(hex);
                var cur = getCurrentTheme();
                applyThemeToPreview(cur);
            }

            colorInput.addEventListener('input', function () {
                hexInput.value = colorInput.value;
                updatePreview();
            });
            hexInput.addEventListener('input', updatePreview);

            row.appendChild(label);
            row.appendChild(colorInput);
            row.appendChild(hexInput);
            container.appendChild(row);
        });
    }

    function init() {
        var merchantId = getMerchantId();
        if (!merchantId) {
            window.location.href = 'login.html';
            return;
        }

        var backLink = document.getElementById('backToIndex');
        if (backLink) {
            backLink.href =
                'index.html?merchantId=' + encodeURIComponent(merchantId);
        }

        fetch('/api/v1/comme/ecpay/config/id=' + encodeURIComponent(merchantId))
            .then(function (r) {
                return r.json().catch(function () {
                    return {};
                });
            })
            .then(function (data) {
                var theme =
                    data.themeColors && typeof data.themeColors === 'object'
                        ? Object.assign({}, defaultTheme, data.themeColors)
                        : defaultTheme;
                buildForm(theme);
                applyThemeToPreview(theme);
            })
            .catch(function () {
                buildForm(defaultTheme);
                applyThemeToPreview(defaultTheme);
            });

        document
            .getElementById('btnSave')
            .addEventListener('click', function () {
                var merchantId = getMerchantId();
                if (!merchantId) return;
                var theme = getCurrentTheme();
                showMessage('儲存中…');
                fetch(
                    '/api/v1/comme/ecpay/config/id=' +
                        encodeURIComponent(merchantId),
                    {
                        method: 'PATCH',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ themeColors: theme }),
                    }
                )
                    .then(function (r) {
                        return r.json().catch(function () {
                            return {};
                        });
                    })
                    .then(function (data) {
                        if (data.error) {
                            showMessage(data.error || '儲存失敗', 'error');
                            return;
                        }
                        showMessage(
                            '已儲存！觀眾斗內頁會套用新顏色。',
                            'success'
                        );
                    })
                    .catch(function () {
                        showMessage('網路錯誤，請稍後再試', 'error');
                    });
            });

        document
            .getElementById('btnPreviewTab')
            .addEventListener('click', function () {
                var merchantId = getMerchantId();
                if (!merchantId) return;
                var url =
                    'viewer-donate.html?merchantId=' +
                    encodeURIComponent(merchantId);
                window.open(url, '_blank');
            });

        document
            .getElementById('btnReset')
            .addEventListener('click', function () {
                buildForm(defaultTheme);
                applyThemeToPreview(defaultTheme);
                showMessage('已還原為預設色，按「儲存」才會寫入。', 'success');
            });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
