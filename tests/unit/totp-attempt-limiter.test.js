/**
 * server/lib/totp-attempt-limiter 的行為測試。
 *
 * 這支限流器擋的是「無限次猜 6 位數 TOTP」的攻擊：
 * 後台多數路由沒有 rate limit，猜中後可用 bind-merchant 把尚未遷移的商店綁走。
 * 因此這裡要確認兩層門檻都會生效，且正常使用者不會被誤鎖。
 */
const {
    LOCK_MS,
    WINDOW_MS,
    MAX_FAILURES_PER_SOURCE,
    MAX_FAILURES_PER_MERCHANT,
    checkTotpAttempt,
    recordTotpFailure,
    recordTotpSuccess,
    resetTotpAttempts,
} = require('../../server/lib/totp-attempt-limiter');

const MERCHANT = 'M12345678';

let nowValue = 1_700_000_000_000;

function advance(ms) {
    nowValue += ms;
}

beforeEach(() => {
    resetTotpAttempts();
    nowValue = 1_700_000_000_000;
    jest.spyOn(Date, 'now').mockImplementation(() => nowValue);
});

afterEach(() => {
    Date.now.mockRestore();
});

function failFrom(ip, times) {
    for (let i = 0; i < times; i++) {
        recordTotpFailure({ merchantId: MERCHANT, ip });
    }
}

describe('單一來源門檻', () => {
    test('未達門檻前都可以繼續嘗試', () => {
        failFrom('1.1.1.1', MAX_FAILURES_PER_SOURCE - 1);
        expect(
            checkTotpAttempt({ merchantId: MERCHANT, ip: '1.1.1.1' }).allowed
        ).toBe(true);
    });

    test('達到門檻即鎖定，並回傳剩餘秒數', () => {
        failFrom('1.1.1.1', MAX_FAILURES_PER_SOURCE);

        const gate = checkTotpAttempt({ merchantId: MERCHANT, ip: '1.1.1.1' });
        expect(gate.allowed).toBe(false);
        expect(gate.retryAfterSec).toBeGreaterThan(0);
        expect(gate.retryAfterSec).toBeLessThanOrEqual(LOCK_MS / 1000);
    });

    test('鎖定只影響該 IP，不影響同商店的其他來源', () => {
        failFrom('1.1.1.1', MAX_FAILURES_PER_SOURCE);

        expect(
            checkTotpAttempt({ merchantId: MERCHANT, ip: '1.1.1.1' }).allowed
        ).toBe(false);
        expect(
            checkTotpAttempt({ merchantId: MERCHANT, ip: '2.2.2.2' }).allowed
        ).toBe(true);
    });

    test('鎖定時間過後自動解除', () => {
        failFrom('1.1.1.1', MAX_FAILURES_PER_SOURCE);
        advance(LOCK_MS + 1000);

        expect(
            checkTotpAttempt({ merchantId: MERCHANT, ip: '1.1.1.1' }).allowed
        ).toBe(true);
    });

    test('失敗之間間隔超過觀察窗就重新計數', () => {
        failFrom('1.1.1.1', MAX_FAILURES_PER_SOURCE - 1);
        advance(WINDOW_MS + 1000);
        failFrom('1.1.1.1', MAX_FAILURES_PER_SOURCE - 1);

        expect(
            checkTotpAttempt({ merchantId: MERCHANT, ip: '1.1.1.1' }).allowed
        ).toBe(true);
    });
});

describe('單一商店門檻（擋換 IP 的分散猜測）', () => {
    test('換 IP 累積到商店門檻後，整間商店都被鎖住', () => {
        for (let i = 0; i < MAX_FAILURES_PER_MERCHANT; i++) {
            recordTotpFailure({ merchantId: MERCHANT, ip: `10.0.0.${i}` });
        }

        expect(
            checkTotpAttempt({ merchantId: MERCHANT, ip: '9.9.9.9' }).allowed
        ).toBe(false);
    });

    test('不影響其他商店', () => {
        for (let i = 0; i < MAX_FAILURES_PER_MERCHANT; i++) {
            recordTotpFailure({ merchantId: MERCHANT, ip: `10.0.0.${i}` });
        }

        expect(
            checkTotpAttempt({ merchantId: 'OTHER', ip: '9.9.9.9' }).allowed
        ).toBe(true);
    });
});

describe('驗證成功後的清除行為', () => {
    test('成功會清掉自己來源的失敗紀錄', () => {
        failFrom('1.1.1.1', MAX_FAILURES_PER_SOURCE - 1);
        recordTotpSuccess({ merchantId: MERCHANT, ip: '1.1.1.1' });
        failFrom('1.1.1.1', MAX_FAILURES_PER_SOURCE - 1);

        expect(
            checkTotpAttempt({ merchantId: MERCHANT, ip: '1.1.1.1' }).allowed
        ).toBe(true);
    });

    test('成功不會清掉商店層的計數，否則攻擊者可自行歸零', () => {
        for (let i = 0; i < MAX_FAILURES_PER_MERCHANT - 1; i++) {
            recordTotpFailure({ merchantId: MERCHANT, ip: `10.0.0.${i}` });
        }
        recordTotpSuccess({ merchantId: MERCHANT, ip: '10.0.0.0' });
        recordTotpFailure({ merchantId: MERCHANT, ip: '10.0.0.99' });

        expect(
            checkTotpAttempt({ merchantId: MERCHANT, ip: '8.8.8.8' }).allowed
        ).toBe(false);
    });
});

describe('邊界情況', () => {
    test('沒有 merchantId 一律放行，交由呼叫端回 400', () => {
        expect(
            checkTotpAttempt({ merchantId: '', ip: '1.1.1.1' }).allowed
        ).toBe(true);
        recordTotpFailure({ merchantId: '', ip: '1.1.1.1' });
        expect(
            checkTotpAttempt({ merchantId: '', ip: '1.1.1.1' }).allowed
        ).toBe(true);
    });

    test('沒有 IP 時仍能依商店層門檻鎖定', () => {
        for (let i = 0; i < MAX_FAILURES_PER_SOURCE; i++) {
            recordTotpFailure({ merchantId: MERCHANT });
        }

        expect(checkTotpAttempt({ merchantId: MERCHANT }).allowed).toBe(false);
    });

    test('merchantId 前後空白視為同一間商店', () => {
        failFrom('1.1.1.1', MAX_FAILURES_PER_SOURCE);

        expect(
            checkTotpAttempt({ merchantId: ` ${MERCHANT} `, ip: '1.1.1.1' })
                .allowed
        ).toBe(false);
    });
});
