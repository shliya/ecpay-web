/** payment_pending_orders.status */
const PAYMENT_PENDING_STATUS = {
    PENDING: 'pending',
    COMPLETED: 'completed',
    EXPIRED: 'expired',
    FAILED: 'failed',
};

const DONATION_PENDING_KINDS = new Set([
    'ecpay-donation',
    'opay-donation',
    'payuni-donation',
]);

function isDonationPendingKind(kind) {
    return DONATION_PENDING_KINDS.has(String(kind || '').trim());
}

module.exports = {
    PAYMENT_PENDING_STATUS,
    DONATION_PENDING_KINDS,
    isDonationPendingKind,
};
