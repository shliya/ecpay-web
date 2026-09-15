/**
 * TOTP 驗證失敗計數與鎖定。
 *
 * 為什麼需要這支：後台的 requireMerchantAuth 在沒有 Google session 時會退回
 * requireTotp，而多數後台路由並沒有掛 rate limit，等於可以無限次猜 6 位數驗證碼。
 * speakeasy 的 window:1 代表任一時刻有 3 組有效碼，單次命中率 3/10^6；
 * 以 20 req/s 連猜約 3 小時就有五成機率命中，猜中後還能用
 * POST /api/v1/me/bind-merchant 把尚未遷移的商店綁走。這裡把那條路堵死。
 *
 * 兩層門檻，各自解決不同的攻擊型態：
 *   1. 單一來源（IP + 商店）——擋住從一台機器猛猜的攻擊者
 *   2. 單一商店（不分來源）——擋住換 IP 的分散式猜測
 *
 * 第 2 層的代價是有人可以刻意猜錯來癱瘓某間商店的 TOTP 登入。
 * 取捨後仍保留，理由是：
 *   - 已遷移到 Google 的商店走的是 session 判斷，根本不會進到這裡，不受影響
 *   - 鎖定只有 15 分鐘且會自動解除，比起商店被永久接管，這個代價可以接受
 *   - 商店層的門檻（30 次）遠高於單一來源（5 次），正常使用者打不到
 *
 * 狀態放在記憶體：與專案既有的 express-rate-limit 一致（它預設也是記憶體）。
 * 多台機器部署時各自計數，門檻等同乘上機器數，屆時要換成 Redis 或資料表。
 */

/** 失敗紀錄的觀察窗：超過這段時間沒有新的失敗就重新計數 */
const WINDOW_MS = 15 * 60 * 1000;

/** 觸發門檻後的鎖定時間 */
const LOCK_MS = 15 * 60 * 1000;

/** 同一 IP 對同一商店允許的連續失敗次數 */
const MAX_FAILURES_PER_SOURCE = 5;

/** 同一商店（所有來源加總）允許的連續失敗次數 */
const MAX_FAILURES_PER_MERCHANT = 30;

/** 記憶體上限，避免被大量不同 merchantId／IP 灌爆 */
const MAX_ENTRIES = 20000;

/** key -> { failures, expiresAt, lockedUntil } */
const attempts = new Map();

function now() {
    return Date.now();
}

function sourceKey(merchantId, ip) {
    return `s:${merchantId}:${ip || 'unknown'}`;
}

function merchantKey(merchantId) {
    return `m:${merchantId}`;
}

/** 清掉已經過期的紀錄。只在超過上限時才全表掃描，平時成本是 O(1) */
function sweepIfNeeded() {
    if (attempts.size <= MAX_ENTRIES) {
        return;
    }
    const current = now();
    for (const [key, entry] of attempts) {
        const alive =
            (entry.lockedUntil && entry.lockedUntil > current) ||
            entry.expiresAt > current;
        if (!alive) {
            attempts.delete(key);
        }
    }
}

/**
 * 取得仍在鎖定中的剩餘秒數；沒被鎖則回 0。
 * 順便把過期的紀錄就地清掉，讓下次失敗從零開始算。
 */
function lockedSecondsFor(key) {
    const entry = attempts.get(key);
    if (!entry) {
        return 0;
    }

    const current = now();

    if (entry.lockedUntil && entry.lockedUntil > current) {
        return Math.ceil((entry.lockedUntil - current) / 1000);
    }

    if (entry.expiresAt <= current) {
        attempts.delete(key);
    }

    return 0;
}

function bumpFailure(key, maxFailures) {
    const current = now();
    const entry = attempts.get(key);

    if (!entry || entry.expiresAt <= current) {
        attempts.set(key, {
            failures: 1,
            expiresAt: current + WINDOW_MS,
            lockedUntil: 0,
        });
        return;
    }

    entry.failures += 1;
    entry.expiresAt = current + WINDOW_MS;

    if (entry.failures >= maxFailures) {
        entry.lockedUntil = current + LOCK_MS;
        entry.failures = 0;
    }
}

/**
 * 驗證前先問這裡：這個來源／商店現在還能不能試。
 *
 * @param {{ merchantId: string, ip?: string }} params
 * @returns {{ allowed: boolean, retryAfterSec: number }}
 */
function checkTotpAttempt({ merchantId, ip }) {
    const trimmed = String(merchantId || '').trim();
    if (!trimmed) {
        return { allowed: true, retryAfterSec: 0 };
    }

    const locked = Math.max(
        lockedSecondsFor(sourceKey(trimmed, ip)),
        lockedSecondsFor(merchantKey(trimmed))
    );

    return locked > 0
        ? { allowed: false, retryAfterSec: locked }
        : { allowed: true, retryAfterSec: 0 };
}

/**
 * 驗證失敗後呼叫。累計到門檻就開始鎖定。
 * @param {{ merchantId: string, ip?: string }} params
 */
function recordTotpFailure({ merchantId, ip }) {
    const trimmed = String(merchantId || '').trim();
    if (!trimmed) {
        return;
    }

    sweepIfNeeded();
    bumpFailure(sourceKey(trimmed, ip), MAX_FAILURES_PER_SOURCE);
    bumpFailure(merchantKey(trimmed), MAX_FAILURES_PER_MERCHANT);
}

/**
 * 驗證成功後呼叫，清掉該來源的失敗紀錄。
 *
 * 商店層的計數刻意「不」一併清除：否則攻擊者只要中途用自己的商店驗證成功，
 * 就能把別人商店的計數歸零。成功者自己的來源解鎖即可，商店層等觀察窗自然過期。
 *
 * @param {{ merchantId: string, ip?: string }} params
 */
function recordTotpSuccess({ merchantId, ip }) {
    const trimmed = String(merchantId || '').trim();
    if (!trimmed) {
        return;
    }
    attempts.delete(sourceKey(trimmed, ip));
}

/** 測試用：清空所有狀態 */
function resetTotpAttempts() {
    attempts.clear();
}

module.exports = {
    WINDOW_MS,
    LOCK_MS,
    MAX_FAILURES_PER_SOURCE,
    MAX_FAILURES_PER_MERCHANT,
    checkTotpAttempt,
    recordTotpFailure,
    recordTotpSuccess,
    resetTotpAttempts,
};
