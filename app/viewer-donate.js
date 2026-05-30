import './css/viewer-donate.css';
import {
    LCF_POST_DONATE_FORM_URL,
    LCF_POST_DONATE_FORM_TITLE,
    LCF_POST_DONATE_FORM_HINT,
} from './js/lcf-post-donate-form.js';
import { donateThemeVarMap } from './js/donate-theme-keys.js';

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

    function init() {
        var merchantId = getQuery('merchantId');
        var nameParam = getQuery('name');

        if (merchantId) {
            showError('正在載入…');
            fetchConfigByMerchantId(merchantId)
                .then(function (config) {
                    showError('');
                    if (config.displayName) {
                        return runPage(merchantId, config);
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
                        return runPage(resolvedId);
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

    function applyTheme(theme) {
        if (!theme || typeof theme !== 'object') return;
        var root = document.documentElement;
        Object.keys(donateThemeVarMap).forEach(function (key) {
            if (theme[key]) {
                root.style.setProperty(donateThemeVarMap[key], theme[key]);
            }
        });
    }

    function applyPaymentVisibility(cfg) {
        cfg = cfg || {};
        var isLcf = getLargeCrowdfundingPageId() != null;
        var ecpayOk = isLcf
            ? cfg.lcfEcpayEnabled !== false
            : cfg.ecpayEnabled !== false;
        var payuniOk = isLcf
            ? cfg.lcfPayuniEnabled !== false
            : cfg.payuniEnabled !== false;
        var opayOk =
            (isLcf ? cfg.lcfOpayEnabled !== false : cfg.opayEnabled !== false) &&
            cfg.opayConfigured === true;
        var paymentsEl = document.getElementById('donatePayments');
        var btnEcpay = document.getElementById('btnEcpay');
        var linkPayuni = document.getElementById('linkPayuni');
        var linkOpay = document.getElementById('linkOpay');
        if (btnEcpay) {
            btnEcpay.style.display = ecpayOk ? '' : 'none';
        }
        if (linkPayuni) {
            linkPayuni.style.display = payuniOk ? '' : 'none';
        }
        if (linkOpay) {
            linkOpay.style.display = opayOk ? '' : 'none';
        }
        if (paymentsEl) {
            paymentsEl.style.display =
                ecpayOk || payuniOk || opayOk ? '' : 'none';
        }
    }

    function getLargeCrowdfundingPageId() {
        var raw = getQuery('largeCrowdfundingPageId');
        if (!raw) {
            return null;
        }
        var n = parseInt(raw, 10);
        return Number.isInteger(n) && n > 0 ? n : null;
    }

    function readDonationFields(amountInput) {
        var name =
            (document.getElementById('nickname') &&
                document.getElementById('nickname').value) ||
            '';
        var amount =
            amountInput && amountInput.value
                ? parseInt(amountInput.value, 10)
                : 0;
        var message =
            (document.getElementById('message') &&
                document.getElementById('message').value) ||
            '';
        if (!amount || isNaN(amount) || amount < 30) {
            showError('請輸入有效金額（至少 30 元）');
            return null;
        }
        return {
            name: name,
            amount: amount,
            message: message,
        };
    }

    function setupLcfFormStep(largeCrowdfundingPageId, onConfirmPayment) {
        if (!largeCrowdfundingPageId) {
            return null;
        }

        var modalEl = document.getElementById('lcfFormModal');
        var openLink = document.getElementById('lcfFormOpenLink');
        var confirmBtn = document.getElementById('lcfFormConfirmBtn');
        var backBtn = document.getElementById('lcfFormBackBtn');
        var closeBtn = document.getElementById('lcfFormCloseBtn');
        var titleEl = document.getElementById('lcfFormStepTitle');
        var hintEl = document.getElementById('lcfFormStepHint');

        if (!modalEl || !openLink || !confirmBtn || !backBtn) {
            return null;
        }

        if (titleEl) {
            titleEl.textContent = LCF_POST_DONATE_FORM_TITLE;
        }
        if (hintEl) {
            hintEl.textContent = LCF_POST_DONATE_FORM_HINT;
        }
        openLink.href = LCF_POST_DONATE_FORM_URL;

        var pendingProvider = null;

        function hideModal() {
            pendingProvider = null;
            modalEl.classList.remove('is-open');
            modalEl.style.display = 'none';
            modalEl.setAttribute('aria-hidden', 'true');
            document.body.style.overflow = '';
        }

        function showModal(provider) {
            pendingProvider = provider;
            showError('');
            modalEl.style.display = 'flex';
            modalEl.classList.add('is-open');
            modalEl.setAttribute('aria-hidden', 'false');
            document.body.style.overflow = 'hidden';
        }

        function onBackdropClick(e) {
            if (e.target === modalEl) {
                hideModal();
            }
        }

        modalEl.addEventListener('click', onBackdropClick);

        document.addEventListener('keydown', function (e) {
            if (e.key === 'Escape' && modalEl.classList.contains('is-open')) {
                hideModal();
            }
        });

        backBtn.addEventListener('click', hideModal);
        if (closeBtn) {
            closeBtn.addEventListener('click', hideModal);
        }

        confirmBtn.addEventListener('click', function () {
            if (!pendingProvider) {
                return;
            }
            var provider = pendingProvider;
            hideModal();
            onConfirmPayment(provider);
        });

        return showModal;
    }

    async function runPage(merchantId, prefetchedConfig) {
        var largeCrowdfundingPageId = getLargeCrowdfundingPageId();
        var donateWindow = document.getElementById('donateWindow');
        if (donateWindow) {
            donateWindow.classList.toggle(
                'is-lcf-donate',
                largeCrowdfundingPageId != null
            );
        }
        var data = {};
        try {
            var r = await fetch(
                '/api/v1/comme/ecpay/config/public/id=' +
                    encodeURIComponent(merchantId)
            );
            data = await r.json();
        } catch {
            data = prefetchedConfig || {};
        }
        if (data.themeColors) applyTheme(data.themeColors);
        applyPaymentVisibility(data);

        const amountInput = document.getElementById('amount');
        const quickBtns = document.querySelectorAll('.quick button');
        const btnEcpay = document.getElementById('btnEcpay');
        const linkPayuni = document.getElementById('linkPayuni');
        const linkOpay = document.getElementById('linkOpay');

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

        function payWithPayuni(fields) {
            var name = fields.name;
            var amount = fields.amount;
            var message = fields.message;

                linkPayuni.style.pointerEvents = 'none';
                var originalText = linkPayuni.textContent;
                linkPayuni.textContent = '處理中…';

                var payuniBody = {
                    merchantId: merchantId,
                    amount: amount,
                    name: name.trim() || undefined,
                    message: message.trim() || undefined,
                };
                if (largeCrowdfundingPageId) {
                    payuniBody.largeCrowdfundingPageId =
                        largeCrowdfundingPageId;
                }
                fetch('/api/v1/comme/donate/payuni', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payuniBody),
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
        }

        function payWithOpay(fields) {
            var name = fields.name;
            var amount = fields.amount;
            var message = fields.message;

                linkOpay.style.pointerEvents = 'none';
                var originalTextOpay = linkOpay.textContent;
                linkOpay.textContent = '處理中…';

                var opayBody = {
                    merchantId: merchantId,
                    amount: amount,
                    name: name.trim() || undefined,
                    message: message.trim() || undefined,
                };
                if (largeCrowdfundingPageId) {
                    opayBody.largeCrowdfundingPageId =
                        largeCrowdfundingPageId;
                }
                fetch('/api/v1/comme/donate/opay', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(opayBody),
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

                        linkOpay.style.pointerEvents = '';
                        linkOpay.textContent = originalTextOpay;

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
        }

        async function payWithEcpay(fields) {
            var name = fields.name;
            var amount = fields.amount;
            var message = fields.message;

            btnEcpay.disabled = true;
            btnEcpay.textContent = '處理中…';

            try {
                var ecpayBody = {
                    merchantId: merchantId,
                    amount: amount,
                    name: name.trim() || undefined,
                    message: message.trim() || undefined,
                };
                if (largeCrowdfundingPageId) {
                    ecpayBody.largeCrowdfundingPageId =
                        largeCrowdfundingPageId;
                }
                const res = await fetch('/api/v1/comme/donate/ecpay', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(ecpayBody),
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
        }

        function runPayment(provider, fields) {
            if (provider === 'payuni') {
                payWithPayuni(fields);
            } else if (provider === 'opay') {
                payWithOpay(fields);
            } else if (provider === 'ecpay') {
                payWithEcpay(fields);
            }
        }

        var showLcfFormStep = setupLcfFormStep(
            largeCrowdfundingPageId,
            function (provider) {
                var fields = readDonationFields(amountInput);
                if (!fields) {
                    return;
                }
                runPayment(provider, fields);
            }
        );

        function onPaymentClick(e, provider) {
            if (e) {
                e.preventDefault();
            }
            showError('');
            var fields = readDonationFields(amountInput);
            if (!fields) {
                return;
            }
            if (showLcfFormStep) {
                showLcfFormStep(provider);
                return;
            }
            runPayment(provider, fields);
        }

        if (linkPayuni) {
            linkPayuni.addEventListener('click', function (e) {
                onPaymentClick(e, 'payuni');
            });
        }

        if (linkOpay) {
            linkOpay.addEventListener('click', function (e) {
                onPaymentClick(e, 'opay');
            });
        }

        if (btnEcpay) {
            btnEcpay.addEventListener('click', function (e) {
                onPaymentClick(e, 'ecpay');
            });
        }
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
