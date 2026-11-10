const ecpayConfigStore = require('../store/ecpay-config');
const { ECPAY_CONFIG_DUPLICATE_CODE } = require('../lib/error/code');

/** 三種代號欄位；同一個值在全站只能出現在其中一格 */
const IDENTIFIER_FIELDS = ['merchantId', 'payuniMerchantId', 'opayMerchantId'];

/**
 * 商店代號跨欄位唯一檢查。
 *
 * 資料表的 unique 只保證「欄位內」不重複，但查商店時
 * （getEcpayConfigByMerchantId）會依序比對三個欄位。若 A 店把 payuniMerchantId
 * 設成 B 店的綠界代號，PayUni 回調查到 A 店、下游卻用同一個字串查到 B 店，
 * 斗內通知與募資進度就會落到 B 店；反過來也能讓 B 店的回調查錯店而被拒收。
 *
 * @param {object} values 準備寫入的欄位（只檢查代號欄位，空值略過）
 * @param {number|null} ownId 更新時為自己的 id，允許與自己的其他欄位相同
 */
async function assertIdentifiersAvailable(values, ownId = null) {
    const wanted = IDENTIFIER_FIELDS.map(field => values[field])
        .filter(v => v != null && String(v).trim() !== '')
        .map(v => String(v).trim());

    for (const identifier of new Set(wanted)) {
        const users = await ecpayConfigStore.findConfigsUsingIdentifier(
            identifier
        );
        const usedByOther = users.some(row => Number(row.id) !== Number(ownId));
        if (usedByOther) {
            throw new Error(ECPAY_CONFIG_DUPLICATE_CODE.message);
        }
    }
}

/** 代號一律去頭尾空白再存，避免 'ABC ' 與 'ABC' 被當成兩個代號 */
function trimIdentifiers(values) {
    const result = { ...values };
    for (const field of IDENTIFIER_FIELDS) {
        if (typeof result[field] === 'string') {
            result[field] = result[field].trim();
        }
    }
    return result;
}

async function createConfigWithTransaction(rawRow) {
    const row = trimIdentifiers(rawRow);
    await assertIdentifiersAvailable(row);

    const txn = await ecpayConfigStore.getTransaction();
    try {
        const result = await ecpayConfigStore.createEcpayConfig(row, {
            transaction: txn,
        });
        await txn.commit();
        return result;
    } catch (error) {
        // 不論哪種錯誤都要先 rollback，否則交易與連線會一直被佔住
        await txn.rollback();
        if (error.name === 'SequelizeUniqueConstraintError') {
            throw new Error(ECPAY_CONFIG_DUPLICATE_CODE.message);
        }
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
    // 觀眾斗內頁（donate-theme / viewer-donate）
    'bg',
    'windowBg',
    'border',
    'borderLight',
    'text',
    'inputBg',
    'btnBg',
    'btnBorder',
    'btnText',
    'payuniBg',
    'payuniBorder',
    'payuniText',
    'opayBg',
    'opayBorder',
    'opayText',
    'activeBg',
    'activeText',
    'link',
    'linkMuted',
    'error',
    // 舊版 key（相容）
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

function sanitizeThemeColors(value) {
    if (value == null || typeof value !== 'object' || Array.isArray(value)) {
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

function normalizeUpdateField(field, value) {
    if (
        field === 'ecpayEnabled' ||
        field === 'payuniEnabled' ||
        field === 'opayEnabled' ||
        field === 'lcfEcpayEnabled' ||
        field === 'lcfPayuniEnabled' ||
        field === 'lcfOpayEnabled' ||
        field === 'youtubeDonationEnabled'
    ) {
        if (value === true || value === false) return value;
        return null;
    }
    if (field === 'themeColors') {
        return sanitizeThemeColors(value);
    }
    if (field === 'youtubeDonationAmount') {
        const n = Math.floor(Number(value));
        if (!Number.isFinite(n) || n < 1) {
            return null;
        }
        return Math.min(9999, n);
    }
    if (field === 'youtubeDonationMaxPlaySec') {
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
        'opayMerchantId',
        'opayHashKey',
        'opayHashIV',
        'youtubeChannelHandle',
        'youtubeChannelId',
        'youtubeDonationAmount',
        'youtubeDonationMaxPlaySec',
        'themeColors',
        'blockedKeywords',
        'ecpayEnabled',
        'payuniEnabled',
        'youtubeDonationEnabled',
        'opayEnabled',
        'lcfEcpayEnabled',
        'lcfPayuniEnabled',
        'lcfOpayEnabled',
    ];
    const updateData = {};

    for (const field of allowedFields) {
        if (Object.hasOwn(updates, field)) {
            const normalized = normalizeUpdateField(field, updates[field]);
            if (
                (field === 'youtubeDonationAmount' ||
                    field === 'youtubeDonationMaxPlaySec') &&
                normalized === null
            ) {
                continue;
            }
            if (
                (field === 'ecpayEnabled' ||
                    field === 'payuniEnabled' ||
                    field === 'opayEnabled' ||
                    field === 'lcfEcpayEnabled' ||
                    field === 'lcfPayuniEnabled' ||
                    field === 'lcfOpayEnabled' ||
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

    const normalized = trimIdentifiers(updateData);
    if (
        Object.hasOwn(normalized, 'payuniMerchantId') ||
        Object.hasOwn(normalized, 'opayMerchantId')
    ) {
        const current =
            await ecpayConfigStore.getEcpayConfigByMerchantId(merchantId);
        if (!current) {
            return null;
        }
        await assertIdentifiersAvailable(normalized, current.id);
    }

    try {
        return await ecpayConfigStore.updateEcpayConfig(merchantId, normalized);
    } catch (error) {
        if (error.name === 'SequelizeUniqueConstraintError') {
            throw new Error(ECPAY_CONFIG_DUPLICATE_CODE.message);
        }
        throw error;
    }
}

async function updateEcpayTheme(merchantId, themeColors) {
    return await ecpayConfigStore.updateThemeColors(
        merchantId,
        sanitizeThemeColors(themeColors)
    );
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
    getOpayConfigByOpayMerchantId:
        ecpayConfigStore.getOpayConfigByOpayMerchantId,
    getEcpayConfigByMerchantId: ecpayConfigStore.getEcpayConfigByMerchantId,
    getEcpayConfigByDisplayName: ecpayConfigStore.getEcpayConfigByDisplayName,
};
