const ecpayConfigStore = require('../store/ecpay-config');
const { ECPAY_CONFIG_DUPLICATE_CODE } = require('../lib/error/code');

async function createConfigWithTransaction(row) {
    const txn = await ecpayConfigStore.getTransaction();
    try {
        const result = await ecpayConfigStore.createEcpayConfig(row, {
            transaction: txn,
        });
        await txn.commit();
        return result;
    } catch (error) {
        if (error.name === 'SequelizeUniqueConstraintError') {
            throw new Error(ECPAY_CONFIG_DUPLICATE_CODE.message);
        }
        await txn.rollback();
        throw error;
    }
}

async function createEcpayConfig(row) {
    return createConfigWithTransaction(row);
}

async function createPayuniConfig(row) {
    return createConfigWithTransaction(row);
}

const ALLOWED_THEME_COLOR_KEYS = new Set([
    'primary',
    'secondary',
    'background',
    'text',
    'accent',
    'headerBg',
    'footerBg',
    'buttonBg',
    'buttonText',
]);

function normalizeUpdateField(field, value) {
    if (
        field === 'ecpayEnabled' ||
        field === 'payuniEnabled' ||
        field === 'youtubeDonationEnabled'
    ) {
        if (value === true || value === false) return value;
        return null;
    }
    if (field === 'themeColors') {
        if (
            value == null ||
            typeof value !== 'object' ||
            Array.isArray(value)
        ) {
            return null;
        }
        const sanitized = {};
        for (const key of Object.keys(value)) {
            if (ALLOWED_THEME_COLOR_KEYS.has(key)) {
                sanitized[key] = String(value[key]);
            }
        }
        return Object.keys(sanitized).length ? sanitized : null;
    }
    if (field === 'youtubeDonationAmount') {
        const n = Math.floor(Number(value));
        if (!Number.isFinite(n) || n < 1) {
            return null;
        }
        return Math.min(9999, n);
    }
    return value;
}

async function updateEcpayConfig(merchantId, updates) {
    const allowedFields = [
        'displayName',
        'hashKey',
        'hashIV',
        'payuniMerchantId',
        'payuniHashKey',
        'payuniHashIV',
        'youtubeChannelHandle',
        'youtubeChannelId',
        'youtubeDonationAmount',
        'themeColors',
        'blockedKeywords',
        'ecpayEnabled',
        'payuniEnabled',
        'youtubeDonationEnabled',
    ];
    const updateData = {};

    for (const field of allowedFields) {
        if (Object.hasOwn(updates, field)) {
            const normalized = normalizeUpdateField(field, updates[field]);
            if (field === 'youtubeDonationAmount' && normalized === null) {
                continue;
            }
            if (
                (field === 'ecpayEnabled' ||
                    field === 'payuniEnabled' ||
                    field === 'youtubeDonationEnabled') &&
                normalized === null
            ) {
                continue;
            }
            updateData[field] = normalized;
        }
    }

    if (!Object.keys(updateData).length) {
        return ecpayConfigStore.getEcpayConfigByMerchantId(merchantId);
    }

    try {
        return await ecpayConfigStore.updateEcpayConfig(merchantId, updateData);
    } catch (error) {
        if (error.name === 'SequelizeUniqueConstraintError') {
            throw new Error(ECPAY_CONFIG_DUPLICATE_CODE.message);
        }
        throw error;
    }
}

async function updateEcpayTheme(merchantId, themeColors) {
    return await ecpayConfigStore.updateThemeColors(merchantId, themeColors);
}

module.exports = {
    createEcpayConfig,
    createPayuniConfig,
    updateEcpayConfig,
    updateEcpayTheme,
    getPayuniMerchantIdByMerchantId:
        ecpayConfigStore.getPayuniMerchantIdByMerchantId,
    getPayuniConfigByPayuniMerchantId:
        ecpayConfigStore.getPayuniConfigByPayuniMerchantId,
    getEcpayConfigByMerchantId: ecpayConfigStore.getEcpayConfigByMerchantId,
    getEcpayConfigByDisplayName: ecpayConfigStore.getEcpayConfigByDisplayName,
};
