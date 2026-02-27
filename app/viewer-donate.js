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

    function resolveMerchantIdByName(name) {
        return fetch(
            '/api/v1/comme/resolve-name?name=' + encodeURIComponent(name)
        ).then(function (res) {
            return res.json().then(function (data) {
                if (res.ok && data.merchantId) return data.merchantId;
                return null;
            });
        });
    }

    function init() {
        var merchantId = getQuery('merchantId');
        var nameParam = getQuery('name');

        if (merchantId) {
            runPage(merchantId);
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
        fetch('/api/v1/comme/ecpay/config/id=' + encodeURIComponent(merchantId))
            .then(function (r) {
                return r.json().catch(function () {
                    return {};
                });
            })
            .then(function (data) {
                if (data.themeColors) applyTheme(data.themeColors);
            })
            .catch(function () {});

        const amountInput = document.getElementById('amount');
        const quickBtns = document.querySelectorAll('.quick button');
        const btnEcpay = document.getElementById('btnEcpay');
        const linkPayuni = document.getElementById('linkPayuni');

        if (amountInput) {
            amountInput.addEventListener('input', function (e) {
                var value = e.target.value;
                if (value === '' || value === '-') {
                    return;
                }
                var num = parseFloat(value);
                if (isNaN(num) || num < 0) {
                    e.target.value = '';
                    showError('請輸入有效的正整數');
                    setTimeout(function () {
                        showError('');
                    }, 2000);
                    return;
                }
                if (num < 30) {
                    showError('金額至少需要 30 元');
                    setTimeout(function () {
                        showError('');
                    }, 2000);
                    return;
                }
                e.target.value = Math.floor(num);
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
                    num >= 30 &&
                    num > 0 &&
                    Number.isInteger(num)
                ) {
                    e.target.value = Math.floor(num);
                } else {
                    showError('請貼上有效的金額（至少 30 元）');
                    setTimeout(function () {
                        showError('');
                    }, 2000);
                }
            });
        }

        quickBtns.forEach(function (btn) {
            btn.addEventListener('click', function () {
                quickBtns.forEach(function (b) {
                    b.classList.remove('active');
                });
                btn.classList.add('active');
                amountInput.value = btn.getAttribute('data-value') || '';
                showError('');
            });
        });

        if (linkPayuni) {
            linkPayuni.addEventListener('click', function (e) {
                e.preventDefault();
                showError('');
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

                if (!amount || isNaN(amount) || amount < 30) {
                    showError('請輸入有效金額（至少 30 元）');
                    return;
                }

                linkPayuni.style.pointerEvents = 'none';
                var originalText = linkPayuni.textContent;
                linkPayuni.textContent = '處理中…';

                fetch('/api/v1/comme/donate/payuni', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        merchantId: merchantId,
                        amount: amount,
                        name: name.trim() || undefined,
                        message: message.trim() || undefined,
                    }),
                })
                    .then(function (res) {
                        return res.json().then(function (data) {
                            return { res: res, data: data };
                        });
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

            if (!amount || isNaN(amount) || amount < 30) {
                showError('請輸入有效金額（至少 30 元）');
                return;
            }

            btnEcpay.disabled = true;
            btnEcpay.textContent = '處理中…';

            try {
                const res = await fetch('/api/v1/comme/donate/ecpay', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        merchantId: merchantId,
                        amount: amount,
                        name: name.trim() || undefined,
                        message: message.trim() || undefined,
                    }),
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
