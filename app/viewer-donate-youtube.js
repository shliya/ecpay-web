import './css/viewer-donate.css';

(function () {
    function getQuery(name) {
        var params = new URLSearchParams(window.location.search);
        return (params.get(name) || '').trim();
    }

    function showError(msg) {
        var el = document.getElementById('errorMsg');
        if (!el) return;
        el.textContent = msg || '';
        el.style.display = msg ? 'block' : 'none';
    }

    function submitToEcpay(paymentUrl, params) {
        var form = document.createElement('form');
        form.method = 'POST';
        form.action = paymentUrl;
        form.enctype = 'application/x-www-form-urlencoded';
        form.style.display = 'none';
        Object.keys(params).forEach(function (key) {
            var input = document.createElement('input');
            input.type = 'hidden';
            input.name = key;
            input.value = params[key] == null ? '' : String(params[key]);
            form.appendChild(input);
        });
        document.body.appendChild(form);
        form.submit();

        setTimeout(function () {
            if (form.parentNode) {
                form.parentNode.removeChild(form);
            }
        }, 1000);
    }

    var typingInterval = null;

    function typeText(element, text, speed) {
        speed = speed || 30;
        element.textContent = '';
        var index = 0;
        return new Promise(function (resolve) {
            typingInterval = setInterval(function () {
                element.textContent += text[index];
                index++;
                if (index >= text.length) {
                    clearInterval(typingInterval);
                    typingInterval = null;
                    resolve();
                }
            }, speed);
        });
    }

    function showDonationAnimation(name, amount) {
        var animationBox = document.getElementById('donationAnimationBox');
        if (!animationBox) {
            animationBox = document.createElement('div');
            animationBox.id = 'donationAnimationBox';
            animationBox.className = 'donation-animation-box';
            document.body.appendChild(animationBox);
        }

        var text = name + ' 送出了 ' + amount + ' 金幣！';

        animationBox.style.display = 'block';

        if (typingInterval) {
            clearInterval(typingInterval);
            typingInterval = null;
        }

        typeText(animationBox, text, 30).then(function () {
            setTimeout(function () {
                animationBox.style.display = 'none';
            }, 3000);
        });
    }

    async function resolveMerchantIdByName(name) {
        const res = await fetch(
            '/api/v1/comme/resolve-name?name=' + encodeURIComponent(name)
        );
        const data = await res.json();
        if (res.ok && data.merchantId) return data.merchantId;
        return null;
    }

    async function fetchConfigByMerchantId(merchantId) {
        const r = await fetch(
            '/api/v1/comme/ecpay/config/public/id=' +
                encodeURIComponent(merchantId)
        );
        try {
            return await r.json();
        } catch {
            return {};
        }
    }

    function computeYoutubePlaySeconds(amount, pricing) {
        var p = Math.max(1, pricing.pricePerSec || 30);
        var maxS = Math.max(1, pricing.maxPlaySec || 30);
        var n = Math.floor(Number(amount));
        if (!Number.isFinite(n) || n < p) {
            return 0;
        }
        return Math.min(maxS, Math.floor(n / p));
    }

    function updateYtHint(amountInput, youtubeInput, pricing) {
        var hint = document.getElementById('ytSecondsHint');
        if (!hint) return;
        var amt =
            amountInput && amountInput.value
                ? parseInt(amountInput.value, 10)
                : 0;
        var yt =
            youtubeInput && youtubeInput.value ? youtubeInput.value.trim() : '';
        var minPay = Math.max(1, pricing.pricePerSec || 30);
        var maxS = Math.max(1, pricing.maxPlaySec || 30);
        if (!yt) {
            hint.textContent =
                '貼上 YouTube 影片連結後，會依「每秒 ' +
                minPay +
                ' 元」換算可播放秒數（單筆最多 ' +
                maxS +
                ' 秒）。';
            return;
        }
        var sec = computeYoutubePlaySeconds(amt, pricing);
        if (sec <= 0) {
            hint.textContent =
                '已填影片連結時，金額至少需 ' + minPay + ' 元（每秒 ' + minPay + ' 元）。';
            return;
        }
        hint.textContent =
            '付款成功後約可播放 ' + sec + ' 秒（實際以付款完成金額為準）。';
    }

    function getYoutubeUrlPayload() {
        var el = document.getElementById('youtubeUrl');
        var v = el && el.value ? el.value.trim() : '';
        return v || undefined;
    }

    function init() {
        var merchantId = getQuery('merchantId');
        var nameParam = getQuery('name');

        if (merchantId) {
            showError('正在載入…');
            fetchConfigByMerchantId(merchantId)
                .then(function (config) {
                    showError('');
                    if (config.displayName) {
                        runPage(merchantId);
                    } else {
                        showError(
                            '此實況主尚未設定顯示名稱，請先至設定頁面設定後再使用'
                        );
                    }
                })
                .catch(function () {
                    showError('無法取得設定，請稍後再試');
                });
            return;
        }
        if (nameParam) {
            showError('正在載入…');
            resolveMerchantIdByName(nameParam)
                .then(function (resolvedId) {
                    showError('');
                    if (resolvedId) {
                        runPage(resolvedId);
                    } else {
                        showError(
                            '找不到對應的實況主（請確認網址的 name 是否正確）'
                        );
                    }
                })
                .catch(function () {
                    showError('無法解析實況主名稱，請稍後再試');
                });
            return;
        }
        showError(
            '請在網址加上 merchantId 或 name，例如：?merchantId=你的商店代號 或 ?name=實況主名稱'
        );
    }

    var themeVarMap = {
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

    function applyTheme(theme) {
        if (!theme || typeof theme !== 'object') return;
        var root = document.documentElement;
        Object.keys(themeVarMap).forEach(function (key) {
            if (theme[key]) {
                root.style.setProperty(themeVarMap[key], theme[key]);
            }
        });
    }

    function runPage(merchantId) {
        var pricing = {
            pricePerSec: 30,
            maxPlaySec: 30,
            youtubeDonationEnabled: false,
        };

        fetch(
            '/api/v1/comme/ecpay/config/public/id=' +
                encodeURIComponent(merchantId)
        )
            .then(async function (r) {
                try {
                    return await r.json();
                } catch {
                    return {};
                }
            })
            .then(function (data) {
                if (data.themeColors) applyTheme(data.themeColors);
                if (data.youtubeDonationEnabled === true) {
                    pricing.youtubeDonationEnabled = true;
                }
                if (data.youtubeDonationAmount != null) {
                    var pp = parseInt(data.youtubeDonationAmount, 10);
                    if (Number.isFinite(pp) && pp >= 1) {
                        pricing.pricePerSec = Math.min(9999, pp);
                    }
                }
                if (data.youtubeDonationMaxPlaySec != null) {
                    var mx = parseInt(data.youtubeDonationMaxPlaySec, 10);
                    if (Number.isFinite(mx) && mx >= 1) {
                        pricing.maxPlaySec = mx;
                    }
                }
            })
            .catch(function () {})
            .finally(function () {
                mountYoutubeDonatePage(merchantId, pricing);
            });
    }

    function mountYoutubeDonatePage(merchantId, pricing) {
        const amountInput = document.getElementById('amount');
        const youtubeInput = document.getElementById('youtubeUrl');
        const quickBtns = document.querySelectorAll('.quick button');
        const btnEcpay = document.getElementById('btnEcpay');
        const linkPayuni = document.getElementById('linkPayuni');
        const altLinks = document.querySelector('.alt-links');

        if (pricing.youtubeDonationEnabled !== true) {
            if (btnEcpay) {
                btnEcpay.style.display = 'none';
            }
            if (altLinks) {
                altLinks.style.display = 'none';
            }
            showError('影音斗內已關閉');
            return;
        }

        var minPay = Math.max(1, pricing.pricePerSec || 30);

        function wireHint() {
            updateYtHint(amountInput, youtubeInput, pricing);
        }

        function minAmountRequired() {
            var yt =
                youtubeInput && youtubeInput.value
                    ? youtubeInput.value.trim()
                    : '';
            return yt ? minPay : 30;
        }

        if (youtubeInput) {
            youtubeInput.addEventListener('input', wireHint);
            youtubeInput.addEventListener('change', wireHint);
        }

        if (amountInput) {
            amountInput.addEventListener('input', function (e) {
                var value = e.target.value;
                if (value === '' || value === '-') {
                    wireHint();
                    return;
                }
                var num = parseFloat(value);
                if (isNaN(num) || num < 0) {
                    e.target.value = '';
                    showError('請輸入有效的正整數');
                    setTimeout(function () {
                        showError('');
                    }, 2000);
                    wireHint();
                    return;
                }
                if (num < minAmountRequired()) {
                    showError(
                        '金額至少需要 ' + minAmountRequired() + ' 元'
                    );
                    setTimeout(function () {
                        showError('');
                    }, 2000);
                    wireHint();
                    return;
                }
                e.target.value = Math.floor(num);
                wireHint();
            });

            amountInput.addEventListener('keydown', function (e) {
                if (
                    e.key === '-' ||
                    e.key === '+' ||
                    e.key === 'e' ||
                    e.key === 'E' ||
                    e.key === '.'
                ) {
                    e.preventDefault();
                }
            });

            amountInput.addEventListener('paste', function (e) {
                e.preventDefault();
                var paste = (e.clipboardData || window.clipboardData).getData(
                    'text'
                );
                var num = parseFloat(paste);
                if (
                    !isNaN(num) &&
                    num >= minAmountRequired() &&
                    num > 0 &&
                    Number.isInteger(num)
                ) {
                    e.target.value = Math.floor(num);
                } else {
                    showError(
                        '請貼上有效的金額（至少 ' +
                            minAmountRequired() +
                            ' 元）'
                    );
                    setTimeout(function () {
                        showError('');
                    }, 2000);
                }
                wireHint();
            });
        }

        wireHint();

        quickBtns.forEach(function (btn) {
            btn.addEventListener('click', function () {
                quickBtns.forEach(function (b) {
                    b.classList.remove('active');
                });
                btn.classList.add('active');
                amountInput.value = btn.getAttribute('data-value') || '';
                showError('');
                wireHint();
            });
        });

        function buildDonateBody() {
            const name =
                (document.getElementById('nickname') &&
                    document.getElementById('nickname').value) ||
                '';
            const amount =
                amountInput && amountInput.value
                    ? parseInt(amountInput.value, 10)
                    : 0;
            const message =
                (document.getElementById('message') &&
                    document.getElementById('message').value) ||
                '';
            const youtubeUrl = getYoutubeUrlPayload();
            const body = {
                merchantId: merchantId,
                amount: amount,
                name: name.trim() || undefined,
                message: message.trim() || undefined,
            };
            if (youtubeUrl) {
                body.youtubeUrl = youtubeUrl;
            }
            return body;
        }

        function validateBeforePay() {
            const amount =
                amountInput && amountInput.value
                    ? parseInt(amountInput.value, 10)
                    : 0;
            const youtubeUrl = getYoutubeUrlPayload();
            const need = minAmountRequired();
            if (!amount || isNaN(amount) || amount < need) {
                showError('請輸入有效金額（至少 ' + need + ' 元）');
                return false;
            }
            if (
                youtubeUrl &&
                computeYoutubePlaySeconds(amount, pricing) <= 0
            ) {
                showError(
                    '影片斗內金額須至少 ' + minPay + ' 元（每秒 ' + minPay + ' 元）'
                );
                return false;
            }
            if (youtubeUrl && !youtubeUrl.trim()) {
                showError('請貼上有效的 YouTube 連結');
                return false;
            }
            return true;
        }

        if (linkPayuni) {
            linkPayuni.addEventListener('click', function (e) {
                e.preventDefault();
                showError('');
                if (!validateBeforePay()) {
                    return;
                }

                const body = buildDonateBody();

                linkPayuni.style.pointerEvents = 'none';
                var originalText = linkPayuni.textContent;
                linkPayuni.textContent = '處理中…';

                fetch('/api/v1/comme/donate/payuni', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(body),
                })
                    .then(async function (res) {
                        const data = await res.json();
                        return { res: res, data: data };
                    })
                    .catch(function () {
                        return { res: { ok: false }, data: {} };
                    })
                    .then(function (result) {
                        var res = result.res;
                        var data = result.data;

                        linkPayuni.style.pointerEvents = '';
                        linkPayuni.textContent = originalText;

                        if (!res.ok) {
                            showError(data.error || '建立斗內訂單失敗');
                            return;
                        }

                        if (data.paymentUrl && data.params) {
                            const name =
                                (document.getElementById('nickname') &&
                                    document.getElementById('nickname')
                                        .value) ||
                                '';
                            const amount =
                                amountInput && amountInput.value
                                    ? parseInt(amountInput.value, 10)
                                    : 0;
                            showDonationAnimation(
                                name.trim() || '匿名',
                                amount
                            );
                            setTimeout(function () {
                                submitToEcpay(data.paymentUrl, data.params);
                            }, 500);
                            return;
                        }

                        showError('伺服器回傳格式錯誤');
                    });
            });
        }

        if (!btnEcpay) return;

        btnEcpay.addEventListener('click', async function () {
            showError('');
            if (!validateBeforePay()) {
                return;
            }

            const body = buildDonateBody();
            const name =
                (document.getElementById('nickname') &&
                    document.getElementById('nickname').value) ||
                '';
            const amount =
                amountInput && amountInput.value
                    ? parseInt(amountInput.value, 10)
                    : 0;

            btnEcpay.disabled = true;
            btnEcpay.textContent = '處理中…';

            try {
                const res = await fetch('/api/v1/comme/donate/ecpay', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(body),
                });

                const data = await res.json().catch(function () {
                    return {};
                });

                if (!res.ok) {
                    showError(data.error || '建立斗內訂單失敗');
                    btnEcpay.disabled = false;
                    btnEcpay.textContent = '用綠界斗內';
                    return;
                }

                if (data.paymentUrl && data.params) {
                    showDonationAnimation(name.trim() || '匿名', amount);
                    setTimeout(function () {
                        submitToEcpay(data.paymentUrl, data.params);
                        btnEcpay.disabled = false;
                        btnEcpay.textContent = '用綠界斗內';
                    }, 500);
                    return;
                }

                showError('伺服器回傳格式錯誤');
                btnEcpay.disabled = false;
                btnEcpay.textContent = '用綠界斗內';
            } catch (err) {
                showError(err.message || '網路錯誤，請稍後再試');
                btnEcpay.disabled = false;
                btnEcpay.textContent = '用綠界斗內';
            }
        });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
