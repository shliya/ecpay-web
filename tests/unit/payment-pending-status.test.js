const {
    PAYMENT_PENDING_STATUS,
    isDonationPendingKind,
} = require('../../server/lib/payment-pending-status');

describe('payment-pending-status', () => {
    test('斗內類 kind 判定', () => {
        expect(isDonationPendingKind('ecpay-donation')).toBe(true);
        expect(isDonationPendingKind('opay-donation')).toBe(true);
        expect(isDonationPendingKind('payuni-donation')).toBe(true);
        expect(isDonationPendingKind(' ecpay-donation ')).toBe(true);
    });

    test('非斗內 kind 判定', () => {
        expect(isDonationPendingKind('ichiban')).toBe(false);
        expect(isDonationPendingKind('')).toBe(false);
        expect(isDonationPendingKind(null)).toBe(false);
        expect(isDonationPendingKind(undefined)).toBe(false);
    });

    test('狀態常數完整', () => {
        expect(PAYMENT_PENDING_STATUS).toEqual({
            PENDING: 'pending',
            COMPLETED: 'completed',
            EXPIRED: 'expired',
            FAILED: 'failed',
        });
    });
});
