let resolvedToken = null;
const SESSION_KEY_PREFIX = 'totpSession_';

function getSessionStorageKey(merchantId) {
    return `${SESSION_KEY_PREFIX}${String(merchantId).trim()}`;
}

function loadSession(merchantId) {
    try {
        const key = getSessionStorageKey(merchantId);
        const raw = window.localStorage.getItem(key);
        if (!raw) {
            return null;
        }

        const parsed = JSON.parse(raw);
        if (!parsed || !parsed.sessionToken || !parsed.expiresAt) {
            return null;
        }

        return parsed;
    } catch {
        return null;
    }
}

function saveSession(merchantId, sessionToken, expiresAt) {
    try {
        const key = getSessionStorageKey(merchantId);
        const payload = {
            sessionToken,
            expiresAt,
        };
        window.localStorage.setItem(key, JSON.stringify(payload));
    } catch {
        // ignore storage error
    }
}

/**
 * 檢查商戶是否存在且已綁定 TOTP，未綁定則導向綁定頁
 * 不要求輸入驗證碼，僅做狀態檢查
 * @param {string} merchantId
 * @returns {Promise<boolean>}
 */
async function checkTotpBinding(merchantId) {
    if (!merchantId || merchantId === 'null') {
        window.location.href = '/login.html';
        return false;
    }

    try {
        const result = await fetchMerchantStatus(merchantId);

        if (!result.exists) {
            window.location.href = '/login.html';
            return false;
        }

        if (!result.totpEnabled) {
            window.location.href = `totp-setup.html?merchantId=${encodeURIComponent(merchantId)}`;
            return false;
        }

        return true;
    } catch {
        window.location.href = '/login.html';
        return false;
    }
}

/**
 * 進入敏感頁面時的 TOTP 驗證閘道（每次都要求輸入驗證碼）
 * @param {string} merchantId
 * @returns {Promise<boolean>}
 */
async function requireTotpVerification(merchantId) {
    const bindingOk = await checkTotpBinding(merchantId);
    if (!bindingOk) {
        return false;
    }

    // 設定頁需求：每次進入都必須輸入 TOTP，並刷新 24 小時 session
    resolvedToken = null;
    return showOverlay(merchantId);
}

async function fetchMerchantStatus(merchantId) {
    const response = await fetch(
        `/api/v1/login/check-merchant/id=${encodeURIComponent(merchantId)}`
    );

    if (!response.ok) {
        throw new Error('check-merchant failed');
    }

    return response.json();
}

function createOverlay() {
    const overlay = document.createElement('div');
    overlay.id = 'totpGuardOverlay';
    overlay.innerHTML = `
        <div class="totp-guard-card">
            <h2>驗證身份</h2>
            <p>請輸入 Google Authenticator 的 6 位數驗證碼</p>
            <form id="totpGuardForm">
                <input
                    type="text"
                    id="totpGuardInput"
                    maxlength="6"
                    inputmode="numeric"
                    pattern="[0-9]*"
                    placeholder="000000"
                    autocomplete="one-time-code"
                    required
                />
                <button type="submit">驗證</button>
                <div id="totpGuardError" class="totp-guard-error"></div>
            </form>
        </div>
    `;

    const style = document.createElement('style');
    style.textContent = `
        #totpGuardOverlay {
            position: fixed;
            inset: 0;
            z-index: 99999;
            display: flex;
            justify-content: center;
            align-items: center;
            background: rgba(0, 0, 0, 0.85);
            backdrop-filter: blur(4px);
        }
        .totp-guard-card {
            background: #fff;
            border-radius: 12px;
            padding: 40px;
            width: 90%;
            max-width: 360px;
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
            text-align: center;
            animation: totpGuardFadeIn 0.3s ease;
        }
        .totp-guard-card h2 {
            margin: 0 0 8px;
            color: #333;
            font-size: 1.4rem;
        }
        .totp-guard-card p {
            margin: 0 0 24px;
            color: #666;
            font-size: 14px;
        }
        #totpGuardInput {
            width: 100%;
            padding: 14px;
            border: 1px solid #ddd;
            border-radius: 8px;
            font-size: 28px;
            font-weight: 600;
            text-align: center;
            letter-spacing: 10px;
            box-sizing: border-box;
            transition: border-color 0.2s;
        }
        #totpGuardInput:focus {
            outline: none;
            border-color: #2196f3;
            box-shadow: 0 0 0 2px rgba(33, 150, 243, 0.15);
        }
        #totpGuardForm button[type="submit"] {
            width: 100%;
            margin-top: 16px;
            padding: 12px;
            background: #2196f3;
            color: #fff;
            border: none;
            border-radius: 8px;
            font-size: 16px;
            font-weight: 500;
            cursor: pointer;
            transition: background 0.2s;
        }
        #totpGuardForm button[type="submit"]:hover {
            background: #1976d2;
        }
        #totpGuardForm button[type="submit"]:disabled {
            background: #90caf9;
            cursor: not-allowed;
        }
        .totp-guard-error {
            margin-top: 12px;
            color: #c62828;
            font-size: 14px;
            min-height: 20px;
        }
        @keyframes totpGuardFadeIn {
            from { opacity: 0; transform: scale(0.95); }
            to { opacity: 1; transform: scale(1); }
        }
    `;

    document.head.appendChild(style);
    document.body.appendChild(overlay);

    return overlay;
}

function showOverlay(merchantId) {
    return new Promise(resolve => {
        const existing = document.getElementById('totpGuardOverlay');
        if (existing) {
            existing.remove();
        }
        const overlay = createOverlay();
        const input = document.getElementById('totpGuardInput');
        const form = document.getElementById('totpGuardForm');
        const errorDiv = document.getElementById('totpGuardError');
        const submitBtn = form.querySelector('button[type="submit"]');

        input.focus();

        form.addEventListener('submit', async e => {
            e.preventDefault();
            const token = input.value.trim();

            if (!token || token.length !== 6) {
                errorDiv.textContent = '請輸入6位數驗證碼';
                return;
            }

            submitBtn.disabled = true;
            submitBtn.textContent = '驗證中...';
            errorDiv.textContent = '';

            try {
                const response = await fetch('/api/v1/login/verify-totp', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ merchantId, token }),
                });

                const data = await response.json();

                if (response.ok && data.success) {
                    if (data.sessionToken) {
                        const expiresAt =
                            typeof data.expiresAt === 'number'
                                ? data.expiresAt
                                : Date.now() + 24 * 60 * 60 * 1000;
                        resolvedToken = data.sessionToken;
                        saveSession(merchantId, data.sessionToken, expiresAt);
                    } else {
                        resolvedToken = token;
                    }

                    overlay.remove();
                    resolve(true);
                } else {
                    errorDiv.textContent = data.error || '驗證失敗';
                    submitBtn.disabled = false;
                    submitBtn.textContent = '驗證';
                    input.value = '';
                    input.focus();
                }
            } catch {
                errorDiv.textContent = '驗證時發生錯誤，請稍後再試';
                submitBtn.disabled = false;
                submitBtn.textContent = '驗證';
            }
        });
    });
}

/**
 * @returns {string|null}
 */
function getTotpToken() {
    return resolvedToken;
}

export default checkTotpBinding;
export { requireTotpVerification, getTotpToken };
