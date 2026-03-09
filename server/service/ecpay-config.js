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
    return value != null && String(value).trim() ? String(value).trim() : null;
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
        'themeColors',
    ];
    const updateData = {};

    for (const field of allowedFields) {
        if (Object.hasOwn(updates, field)) {
            updateData[field] = normalizeUpdateField(field, updates[field]);
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

module.exports = {
    createEcpayConfig,
    createPayuniConfig,
    updateEcpayConfig,
    getPayuniMerchantIdByMerchantId:
        ecpayConfigStore.getPayuniMerchantIdByMerchantId,
    getPayuniConfigByPayuniMerchantId:
        ecpayConfigStore.getPayuniConfigByPayuniMerchantId,
    getEcpayConfigByMerchantId: ecpayConfigStore.getEcpayConfigByMerchantId,
    getEcpayConfigByDisplayName: ecpayConfigStore.getEcpayConfigByDisplayName,
};
