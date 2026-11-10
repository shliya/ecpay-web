/**
 * 金流回調 ↔ 預存訂單綁定檢查：每一種拒絕原因都要能單獨觸發，
 * 確保是「嚴格比對」而不是只擋最明顯的那一種。
 */
const {
    BINDING_REASON,
    verifyDonationOrderBinding,
    verifyIchibanOrderBinding,
} = require('../../server/lib/payment-order-binding');
const { generateTradeNo } = require('../../server/lib/payment-trade-no');

const okOrder = () => ({
    kind: 'payuni-donation',
    status: 'pending',
    ecpayConfigId: 2,
    amount: 500,
});
const okVerified = () => ({ ecpayConfigId: 2, provider: 'payuni', amount: 500 });

describe('verifyDonationOrderBinding', () => {
    test('店、金流、金額都一致才放行', () => {
        expect(verifyDonationOrderBinding(okOrder(), okVerified())).toEqual({
            ok: true,
        });
    });

    test('字串 id 與數字 id 視為相同（DB 回傳型別不一定）', () => {
        const order = { ...okOrder(), ecpayConfigId: '2', amount: '500' };
        expect(verifyDonationOrderBinding(order, okVerified()).ok).toBe(true);
    });

    test.each([
        [
            '驗簽的店與建單的店不同（跨店偽造）',
            o => o,
            v => ({ ...v, ecpayConfigId: 1 }),
            BINDING_REASON.CONFIG_MISMATCH,
        ],
        [
            '舊版訂單沒有 ecpayConfigId：無法證明歸屬，不放行',
            o => {
                delete o.ecpayConfigId;
                return o;
            },
            v => v,
            BINDING_REASON.ORDER_MISSING_CONFIG,
        ],
        [
            '舊版訂單沒有 amount：不放行',
            o => {
                delete o.amount;
                return o;
            },
            v => v,
            BINDING_REASON.ORDER_MISSING_AMOUNT,
        ],
        [
            '付款金額與建單金額不同',
            o => o,
            v => ({ ...v, amount: 999999 }),
            BINDING_REASON.AMOUNT_MISMATCH,
        ],
        [
            '付款金額少於建單金額',
            o => o,
            v => ({ ...v, amount: 1 }),
            BINDING_REASON.AMOUNT_MISMATCH,
        ],
        [
            '用綠界回調結 PayUni 的單',
            o => o,
            v => ({ ...v, provider: 'ecpay' }),
            BINDING_REASON.PROVIDER_MISMATCH,
        ],
        [
            '未知的金流',
            o => o,
            v => ({ ...v, provider: 'paypal' }),
            BINDING_REASON.INVALID_PROVIDER,
        ],
        [
            '呼叫端漏傳驗簽的店',
            o => o,
            v => ({ ...v, ecpayConfigId: undefined }),
            BINDING_REASON.NO_VERIFIED_CONTEXT,
        ],
        [
            'id 不是正整數（例如 0 或負數）',
            o => ({ ...o, ecpayConfigId: 0 }),
            v => v,
            BINDING_REASON.ORDER_MISSING_CONFIG,
        ],
    ])('%s', (_name, mutateOrder, mutateVerified, reason) => {
        const result = verifyDonationOrderBinding(
            mutateOrder(okOrder()),
            mutateVerified(okVerified())
        );
        expect(result).toEqual({ ok: false, reason });
    });

    test('沒有 verified 參數一律拒絕', () => {
        expect(verifyDonationOrderBinding(okOrder(), undefined)).toEqual({
            ok: false,
            reason: BINDING_REASON.NO_VERIFIED_CONTEXT,
        });
    });

    test('沒有預存訂單一律拒絕', () => {
        expect(verifyDonationOrderBinding(null, okVerified())).toEqual({
            ok: false,
            reason: BINDING_REASON.NO_PENDING,
        });
    });
});

describe('verifyIchibanOrderBinding', () => {
    test('訂單商店與驗簽商店相同才放行', () => {
        expect(
            verifyIchibanOrderBinding({ merchantId: 'M1' }, { merchantId: 'M1' })
        ).toEqual({ ok: true });
    });

    test('商店不同拒絕', () => {
        expect(
            verifyIchibanOrderBinding({ merchantId: 'M1' }, { merchantId: 'M2' })
        ).toEqual({ ok: false, reason: BINDING_REASON.CONFIG_MISMATCH });
    });

    test('驗簽商店沒有 merchantId（例如查設定時漏取欄位）拒絕', () => {
        expect(
            verifyIchibanOrderBinding({ merchantId: 'M1' }, { merchantId: undefined })
        ).toEqual({ ok: false, reason: BINDING_REASON.NO_VERIFIED_CONTEXT });
    });

    test('訂單沒有 merchantId 拒絕', () => {
        expect(verifyIchibanOrderBinding({}, { merchantId: 'M1' })).toEqual({
            ok: false,
            reason: BINDING_REASON.ORDER_MISSING_CONFIG,
        });
    });
});

describe('generateTradeNo', () => {
    test.each(['ECPAY', 'PAYUNI', 'OPAY'])(
        '%s：20 碼大寫英數字，符合綠界／歐付寶規格',
        prefix => {
            const no = generateTradeNo(prefix);
            expect(no).toHaveLength(20);
            expect(no).toMatch(new RegExp(`^${prefix}[0-9A-Z]+$`));
        }
    );

    test('同一毫秒大量產生也不撞號', () => {
        const spy = jest.spyOn(Date, 'now').mockReturnValue(1762750000000);
        try {
            const set = new Set(
                Array.from({ length: 5000 }, () => generateTradeNo('PAYUNI'))
            );
            expect(set.size).toBe(5000);
        } finally {
            spy.mockRestore();
        }
    });

    test('前綴過長導致隨機碼不足時直接報錯', () => {
        expect(() => generateTradeNo('ABCDEFGHIJ')).toThrow();
    });
});
