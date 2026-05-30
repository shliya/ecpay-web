import './css/common.css';
import './css/donate-theme.css';
import checkTotpBinding from './js/totp-guard.js';
import {
    donateThemeDefaults,
    donateThemeFormFields,
    applyDonateTheme,
} from './js/donate-theme-keys.js';

(function () {
    var cachedDisplayName = null;

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

    function getCurrentTheme() {
        var theme = {};
        donateThemeFormFields.forEach(function (item) {
            var hexEl = document.getElementById('theme_' + item.key);
            if (hexEl && hexEl.value) {
                theme[item.key] = hexEl.value.trim();
            }
        });
        return theme;
    }

    function buildForm(currentTheme) {
        var container = document.getElementById('themeFields');
        if (!container) return;
        container.innerHTML = '';
        var t = Object.assign({}, donateThemeDefaults, currentTheme || {});
        var lastSection = null;

        donateThemeFormFields.forEach(function (item) {
            if (item.section && item.section !== lastSection) {
                lastSection = item.section;
                var heading = document.createElement('h3');
                heading.className = 'theme-section-title';
                heading.textContent = item.section;
                container.appendChild(heading);
            }

            var value = t[item.key] || donateThemeDefaults[item.key] || '#000000';
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
            hexInput.setAttribute(
                'aria-label',
                (item.section ? item.section + ' ' : '') + item.label
            );

            function updatePreview() {
                var hex = hexInput.value.trim();
                if (hex && !hex.startsWith('#')) hex = '#' + hex;
                if (hex) colorInput.value = hexToInputColor(hex);
                applyDonateTheme(getCurrentTheme(), document.getElementById('previewWrapper'));
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

    async function init() {
        var merchantId = getMerchantId();
        if (!merchantId) {
            window.location.href = 'login.html';
            return;
        }

        var totpOk = await checkTotpBinding(merchantId);
        if (!totpOk) return;

        var backLink = document.getElementById('backToIndex');
        if (backLink) {
            backLink.href =
                'index.html?merchantId=' + encodeURIComponent(merchantId);
        }

        fetch(
            '/api/v1/comme/ecpay/config/public/id=' +
                encodeURIComponent(merchantId)
        )
            .then(function (r) {
                return r.json().catch(function () {
                    return {};
                });
            })
            .then(function (data) {
                cachedDisplayName = data.displayName || null;
                var theme =
                    data.themeColors && typeof data.themeColors === 'object'
                        ? Object.assign({}, donateThemeDefaults, data.themeColors)
                        : Object.assign({}, donateThemeDefaults);
                buildForm(theme);
                applyDonateTheme(theme, document.getElementById('previewWrapper'));
            })
            .catch(function () {
                buildForm(donateThemeDefaults);
                applyDonateTheme(
                    donateThemeDefaults,
                    document.getElementById('previewWrapper')
                );
            });

        document
            .getElementById('btnSave')
            .addEventListener('click', function () {
                var merchantId = getMerchantId();
                if (!merchantId) return;
                var theme = getCurrentTheme();
                showMessage('儲存中…');
                fetch(
                    '/api/v1/comme/ecpay/theme/id=' +
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
                if (!cachedDisplayName) {
                    showMessage(
                        '請先至設定頁面設定顯示名稱後才能預覽',
                        'error'
                    );
                    return;
                }
                var url =
                    'viewer-donate.html?name=' +
                    encodeURIComponent(cachedDisplayName);
                window.open(url, '_blank');
            });

        document
            .getElementById('btnReset')
            .addEventListener('click', function () {
                buildForm(donateThemeDefaults);
                applyDonateTheme(
                    donateThemeDefaults,
                    document.getElementById('previewWrapper')
                );
                showMessage('已還原為預設色，按「儲存」才會寫入。', 'success');
            });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
