/**
 * 斗內付款回調狀態機：冪等、搶鎖、失敗還原
 */
jest.mock('../../server/store/payment-order', () => ({
    getPaymentOrderForCallback: jest.fn(),
    markPaymentOrderCompleted: jest.fn(),
    revertPaymentOrderFromCompleted: jest.fn(),
}));
jest.mock('../../server/service/large-crowdfunding-donation', () => ({
    completeDonationFromPayment: jest.fn(),
}));

const {
    getPaymentOrderForCallback,
    markPaymentOrderCompleted,
    revertPaymentOrderFromCompleted,
} = require('../../server/store/payment-order');
const {
    completeDonationFromPayment,
} = require('../../server/service/large-crowdfunding-donation');
const {
    processDonationFromPaymentCallback,
    interpretDonationPaymentResult,
    applyPendingDonationMeta,
} = require('../../server/service/donation-payment-callback');

const TRADE_NO = 'ECPAY123';
const baseRow = { merchantId: 'M1', name: 'A', cost: 100, message: 'hi' };

function pendingOrder(overrides = {}) {
    return {
        kind: 'ecpay-donation',
        status: 'pending',
        fullName: null,
        fullMessage: null,
        ...overrides,
    };
}

describe('processDonationFromPaymentCallback', () => {
    test('無 row 直接略過', async () => {
        const result = await processDonationFromPaymentCallback({
            merchantTradeNo: TRADE_NO,
            row: null,
        });
        expect(result).toEqual({
            recorded: false,
            skipped: true,
            reason: 'no-row',
        });
        expect(getPaymentOrderForCallback).not.toHaveBeenCalled();
    });

    test('預存單已 completed：冪等略過、不重複入帳', async () => {
        getPaymentOrderForCallback.mockResolvedValue(
            pendingOrder({ status: 'completed' })
        );

        const result = await processDonationFromPaymentCallback({
            merchantTradeNo: TRADE_NO,
            row: { ...baseRow },
        });

        expect(result.reason).toBe('already-completed');
        expect(markPaymentOrderCompleted).not.toHaveBeenCalled();
        expect(completeDonationFromPayment).not.toHaveBeenCalled();
    });

    test('無預存單：不寫入 donations', async () => {
        getPaymentOrderForCallback.mockResolvedValue(null);

        const result = await processDonationFromPaymentCallback({
            merchantTradeNo: TRADE_NO,
            row: { ...baseRow },
        });

        expect(result.reason).toBe('no-pending-donation');
        expect(completeDonationFromPayment).not.toHaveBeenCalled();
    });

    test('非斗內 kind 的預存單：略過', async () => {
        getPaymentOrderForCallback.mockResolvedValue(
            pendingOrder({ kind: 'ichiban' })
        );

        const result = await processDonationFromPaymentCallback({
            merchantTradeNo: TRADE_NO,
            row: { ...baseRow },
        });

        expect(result.reason).toBe('no-pending-donation');
    });

    test('正常入帳：套用預存 meta、標記 completed', async () => {
        getPaymentOrderForCallback.mockResolvedValue(
            pendingOrder({ fullName: '完整暱稱', fullMessage: '完整留言' })
        );
        markPaymentOrderCompleted.mockResolvedValue(true);
        completeDonationFromPayment.mockResolvedValue(undefined);

        const row = { ...baseRow };
        const result = await processDonationFromPaymentCallback({
            merchantTradeNo: TRADE_NO,
            row,
        });

        expect(result).toEqual({ recorded: true });
        expect(row.name).toBe('完整暱稱');
        expect(row.message).toBe('完整留言');
        expect(markPaymentOrderCompleted).toHaveBeenCalledWith(TRADE_NO);
        expect(revertPaymentOrderFromCompleted).not.toHaveBeenCalled();
    });

    test('搶鎖失敗且他人已入帳：冪等略過', async () => {
        getPaymentOrderForCallback
            .mockResolvedValueOnce(pendingOrder())
            .mockResolvedValueOnce(pendingOrder({ status: 'completed' }));
        markPaymentOrderCompleted.mockResolvedValue(false);

        const result = await processDonationFromPaymentCallback({
            merchantTradeNo: TRADE_NO,
            row: { ...baseRow },
        });

        expect(result.reason).toBe('already-completed');
        expect(completeDonationFromPayment).not.toHaveBeenCalled();
    });

    test('入帳丟例外：還原預存狀態並 rethrow', async () => {
        getPaymentOrderForCallback.mockResolvedValue(pendingOrder());
        markPaymentOrderCompleted.mockResolvedValue(true);
        completeDonationFromPayment.mockRejectedValue(new Error('db down'));

        await expect(
            processDonationFromPaymentCallback({
                merchantTradeNo: TRADE_NO,
                row: { ...baseRow },
            })
        ).rejects.toThrow('db down');

        expect(revertPaymentOrderFromCompleted).toHaveBeenCalledWith(
            TRADE_NO,
            'pending'
        );
    });

    test('LCF 拒絕入帳：還原預存狀態、回 rejected 原因', async () => {
        getPaymentOrderForCallback.mockResolvedValue(
            pendingOrder({ status: 'expired' })
        );
        markPaymentOrderCompleted.mockResolvedValue(true);
        completeDonationFromPayment.mockResolvedValue({
            status: 'rejected',
            reason: 'page-closed',
        });

        const result = await processDonationFromPaymentCallback({
            merchantTradeNo: TRADE_NO,
            row: { ...baseRow },
        });

        expect(result.reason).toBe('page-closed');
        expect(revertPaymentOrderFromCompleted).toHaveBeenCalledWith(
            TRADE_NO,
            'expired'
        );
    });

    test('重複斗內（complete 回 null）：冪等略過', async () => {
        getPaymentOrderForCallback.mockResolvedValue(pendingOrder());
        markPaymentOrderCompleted.mockResolvedValue(true);
        completeDonationFromPayment.mockResolvedValue(null);

        const result = await processDonationFromPaymentCallback({
            merchantTradeNo: TRADE_NO,
            row: { ...baseRow },
        });

        expect(result.reason).toBe('duplicate');
    });
});

describe('interpretDonationPaymentResult', () => {
    test.each([
        [{ status: 'recorded' }, { ok: true, duplicate: false }],
        [{ status: 'duplicate' }, { ok: true, duplicate: true }],
        [null, { ok: true, duplicate: true }],
        [undefined, { ok: true, duplicate: false }],
    ])('%o → %o', (input, expected) => {
        expect(interpretDonationPaymentResult(input)).toEqual(
            expect.objectContaining(expected)
        );
    });

    test('rejected 帶出原因', () => {
        expect(
            interpretDonationPaymentResult({
                status: 'rejected',
                reason: 'bad',
            })
        ).toEqual({ ok: false, duplicate: false, reason: 'bad' });
    });
});

describe('applyPendingDonationMeta', () => {
    test('只覆蓋有值的 meta 欄位', () => {
        const row = { name: '原名', message: '原留言' };
        applyPendingDonationMeta(row, { fullName: '新名', fullMessage: '' });
        expect(row.name).toBe('新名');
        expect(row.message).toBe('原留言');
    });

    test('null 參數不噴錯', () => {
        expect(() => applyPendingDonationMeta(null, null)).not.toThrow();
    });
});
