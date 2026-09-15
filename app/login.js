import './css/common.css';
import './css/login.css';
import { signOutAll } from './js/auth-logout.js';

/**
 * 登入頁。
 *
 * 單一入口：一律先用 Google 登入，再依帳號狀態分流。
 * 商店代號 + 驗證碼只在「綁定既有商店」時出現，用來證明商店所有權，
 * 不再是登入方式本身。
 */
(function () {
    const googleLoginSection = document.getElementById('googleLoginSection');
    const btnGoogleLogin = document.getElementById('btnGoogleLogin');

    const chooseSection = document.getElementById('chooseSection');
    const chooseHint = document.getElementById('chooseHint');
    const btnGoCreate = document.getElementById('btnGoCreate');
    const btnGoBind = document.getElementById('btnGoBind');
    const btnSignOutChoose = document.getElementById('btnSignOutChoose');

    const createMerchantSection = document.getElementById(
        'createMerchantSection'
    );
    const createMerchantForm = document.getElementById('createMerchantForm');
    const createMerchantIdInput = document.getElementById('createMerchantId');
    const createDisplayNameInput = document.getElementById('createDisplayName');
    const btnCreateBack = document.getElementById('btnCreateBack');

    const bindSection = document.getElementById('bindSection');
    const bindHint = document.getElementById('bindHint');
    const bindForm = document.getElementById('bindForm');
    const bindMerchantIdInput = document.getElementById('bindMerchantId');
    const bindTotpTokenInput = document.getElementById('bindTotpToken');
    const btnBindBack = document.getElementById('btnBindBack');
    const btnSignOut = document.getElementById('btnSignOut');
    const needTotpSetup = document.getElementById('needTotpSetup');
    const needTotpSetupHint = document.getElementById('needTotpSetupHint');
    const linkTotpSetup = document.getElementById('linkTotpSetup');

    const messageDiv = document.getElementById('message');

    let currentUserEmail = '';

    function showMessage(text, type) {
        messageDiv.className = `message ${type}`;
        messageDiv.textContent = text;
        messageDiv.style.display = 'block';
    }

    function hideMessage() {
        messageDiv.style.display = 'none';
    }

    /** 一次只顯示一個區塊 */
    function showOnly(section) {
        googleLoginSection.style.display =
            section === 'google' ? 'block' : 'none';
        chooseSection.style.display = section === 'choose' ? 'block' : 'none';
        createMerchantSection.style.display =
            section === 'create' ? 'block' : 'none';
        bindSection.style.display = section === 'bind' ? 'block' : 'none';
    }

    function showGoogleLoginStep() {
        showOnly('google');
        hideMessage();
    }

    function showChooseStep(email) {
        showOnly('choose');
        hideMessage();
        chooseHint.textContent =
            `已用 ${email} 登入囉～` +
            '這個帳號還沒有商店，選一個方式往下走吧。';
    }

    function showCreateMerchantStep() {
        showOnly('create');
        hideMessage();
        createMerchantIdInput.focus();
    }

    /**
     * @param {string} [prefillMerchantId]
     *   從後台被導回來時帶的商店代號，先填好讓使用者只要輸入驗證碼
     */
    function showBindStep(prefillMerchantId) {
        showOnly('bind');
        hideMessage();
        needTotpSetup.style.display = 'none';
        bindHint.textContent =
            '輸入商店代號與驗證碼，證明這間商店是你的，就能接到現在的 Google 帳號。';

        if (prefillMerchantId) {
            bindMerchantIdInput.value = prefillMerchantId;
            bindTotpTokenInput.focus();
            return;
        }
        bindMerchantIdInput.focus();
    }

    /**
     * 商店存在但還沒設定驗證碼 —— 無法用驗證碼證明所有權。
     * 導去設定頁（該頁用金流 Hash Key 驗證所有權），完成後再回來綁定。
     */
    function showNeedTotpSetup(merchantId) {
        needTotpSetup.style.display = 'block';
        needTotpSetupHint.textContent =
            `商店 ${merchantId} 尚未設定驗證碼，無法直接綁定。` +
            '請先完成驗證碼設定，再回到這裡綁定 Google 帳號。';
        linkTotpSetup.href = `totp-setup.html?merchantId=${encodeURIComponent(merchantId)}`;
    }

    function redirectToMain(merchantId) {
        localStorage.setItem('merchantId', merchantId);
        window.location.href = `index.html?merchantId=${encodeURIComponent(merchantId)}`;
    }

    async function fetchMe() {
        try {
            const response = await fetch('/api/v1/me', {
                credentials: 'same-origin',
            });
            return response.ok ? await response.json() : null;
        } catch {
            return null;
        }
    }

    async function checkMerchant(merchantId) {
        try {
            const response = await fetch(
                `/api/v1/login/check-merchant/id=${encodeURIComponent(merchantId)}`
            );
            return response.ok ? await response.json() : { exists: false };
        } catch {
            return null;
        }
    }

    /**
     * 建立新商店。只送商店代號與顯示名稱 ——
     * 金流金鑰要先到綠界／PayUni／歐富寶各自的後台申請，
     * 拿到之後在設定頁填，不卡在建立這一步。
     */
    async function createMerchant(merchantId, displayName) {
        try {
            const response = await fetch('/api/v1/me/merchants', {
                method: 'POST',
                credentials: 'same-origin',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ merchantId, displayName }),
            });
            const data = await response.json().catch(() => ({}));
            return {
                ok: response.ok,
                nextUrl: data.nextUrl,
                merchantId: data.merchantId,
                error: data.error || '建立商店失敗',
            };
        } catch {
            return { ok: false, error: '無法連線至伺服器，請稍後再試' };
        }
    }

    async function bindMerchant(merchantId, token) {
        try {
            const response = await fetch('/api/v1/me/bind-merchant', {
                method: 'POST',
                credentials: 'same-origin',
                headers: {
                    'Content-Type': 'application/json',
                    'x-totp-token': token,
                },
                body: JSON.stringify({ merchantId }),
            });
            const data = await response.json().catch(() => ({}));
            return { ok: response.ok, error: data.error || '綁定失敗' };
        } catch {
            return { ok: false, error: '無法連線至伺服器，請稍後再試' };
        }
    }

    /**
     * 向 better-auth 取得 Google 授權網址後跳轉。
     * 必須由瀏覽器自己發這個請求：回應會設 better-auth 的 state cookie，
     * Google 導回時要拿它比對，從別處代發會得到 state_mismatch。
     */
    async function startGoogleLogin(button) {
        hideMessage();
        button.disabled = true;
        try {
            const response = await fetch('/api/auth/sign-in/social', {
                method: 'POST',
                credentials: 'same-origin',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    provider: 'google',
                    callbackURL: '/login.html',
                }),
            });
            const data = await response.json().catch(() => ({}));
            if (!response.ok || !data.url) {
                showMessage(data.message || 'Google 登入初始化失敗', 'error');
                button.disabled = false;
                return;
            }
            window.location.href = data.url;
        } catch {
            showMessage('無法連線至登入服務，請稍後再試', 'error');
            button.disabled = false;
        }
    }

    /**
     * 進站時決定停在哪一個畫面：
     *   沒有 Google session → Google 登入
     *   已登入且有商店      → 直接進後台
     *   已登入但沒有商店    → 建立或綁定
     */
    /**
     * 後台守衛把尚未綁定 Google 的使用者導回來時，會帶上 merchantId。
     * 有它就代表「這個人已經有商店，只是還沒遷移」，不必再問他要建立還是綁定。
     */
    function getPendingMerchantId() {
        try {
            const value = new URL(window.location.href).searchParams.get(
                'merchantId'
            );
            return value ? value.trim() : '';
        } catch {
            return '';
        }
    }

    async function init() {
        const me = await fetchMe();
        const pendingMerchantId = getPendingMerchantId();

        if (!me) {
            showGoogleLoginStep();
            // 被導回來的人需要知道自己為什麼突然要登入 Google
            if (pendingMerchantId) {
                showMessage(
                    `商店 ${pendingMerchantId} 已改用 Google 登入，` +
                        '請先登入 Google，再用驗證碼完成綁定',
                    ''
                );
            }
            return;
        }

        currentUserEmail = me.user.email;

        if (Array.isArray(me.merchants) && me.merchants.length > 0) {
            redirectToMain(me.merchants[0].merchantId);
            return;
        }

        // 已登入 Google 但還沒綁商店，而且知道是哪一間 → 直接進綁定步驟
        if (pendingMerchantId) {
            showBindStep(pendingMerchantId);
            return;
        }

        showChooseStep(me.user.email);
    }

    btnGoogleLogin.addEventListener('click', () =>
        startGoogleLogin(btnGoogleLogin)
    );

    btnGoCreate.addEventListener('click', showCreateMerchantStep);
    // 包一層：直接傳 showBindStep 會把 click 事件當成 merchantId 填進輸入框
    btnGoBind.addEventListener('click', () => showBindStep());
    btnSignOutChoose.addEventListener('click', signOutAll);
    btnCreateBack.addEventListener('click', () =>
        showChooseStep(currentUserEmail)
    );
    btnBindBack.addEventListener('click', () =>
        showChooseStep(currentUserEmail)
    );
    btnSignOut.addEventListener('click', signOutAll);

    createMerchantForm.addEventListener('submit', async e => {
        e.preventDefault();
        hideMessage();

        const merchantId = createMerchantIdInput.value.trim();
        if (!merchantId) {
            showMessage('請輸入商店代號', 'error');
            return;
        }

        const submitButton = createMerchantForm.querySelector(
            'button[type="submit"]'
        );
        submitButton.disabled = true;
        const result = await createMerchant(
            merchantId,
            createDisplayNameInput.value.trim()
        );
        submitButton.disabled = false;

        if (!result.ok) {
            showMessage(result.error, 'error');
            return;
        }

        // 建立成功即為擁有者，直接帶去填各家金流的 Hash Key 與 IV
        localStorage.setItem('merchantId', result.merchantId);
        window.location.href =
            result.nextUrl ||
            `settings.html?merchantId=${encodeURIComponent(result.merchantId)}`;
    });

    bindForm.addEventListener('submit', async e => {
        e.preventDefault();
        hideMessage();
        needTotpSetup.style.display = 'none';

        const merchantId = bindMerchantIdInput.value.trim();
        const token = bindTotpTokenInput.value.trim();
        if (!merchantId || !token) {
            showMessage('請輸入商店代號與驗證碼', 'error');
            return;
        }

        const submitButton = bindForm.querySelector('button[type="submit"]');
        submitButton.disabled = true;

        // 先查商店狀態，才能給出具體原因，而不是一律「綁定失敗」
        const status = await checkMerchant(merchantId);
        if (!status) {
            submitButton.disabled = false;
            showMessage('無法連線至伺服器，請稍後再試', 'error');
            return;
        }
        if (!status.exists) {
            submitButton.disabled = false;
            showMessage(
                '找不到這間商店。如果是新商店，請返回選擇「建立新商店」',
                'error'
            );
            return;
        }
        if (status.googleBound) {
            submitButton.disabled = false;
            showMessage(
                '這間商店已經綁定其他 Google 帳號，如有疑問請聯絡管理者',
                'error'
            );
            return;
        }
        if (!status.totpEnabled) {
            submitButton.disabled = false;
            showNeedTotpSetup(merchantId);
            return;
        }

        const result = await bindMerchant(merchantId, token);
        submitButton.disabled = false;

        if (result.ok) {
            redirectToMain(merchantId);
            return;
        }
        showMessage(result.error, 'error');
    });

    init();
})();
