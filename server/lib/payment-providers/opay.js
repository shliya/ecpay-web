/**
 * 歐付寶 OPay All-In-One（AIO）斗內建單與 ReturnURL 驗簽／解析。
 * CheckMacValue：官方技術文件與綠界相同（參數 A–Z 排序、binding、UrlEncode（.NET）、SHA256）；
 * 與本專案 ecpay.js 的 genCheckMacValue 同一路徑。
 */
const path = require('path');
const crypto = require('crypto');
const qs = require('qs');
const dayjs = require('dayjs');
const { ENUM_DONATION_TYPE } = require('../enum');

require('dotenv').config({ path: path.resolve(__dirname, '../../../.env') });

const DEFAULT_OPAY_PAYMENT_URL =
    process.env.NODE_ENV === 'production'
        ? 'https://payment.opay.tw/Cashier/AioCheckOut/V5'
        : 'https://payment-stage.opay.tw/Cashier/AioCheckOut/V5';

function getOpayPaymentApiUrl() {
    if (process.env.NODE_ENV === 'production') {
        return (
            process.env.OPAY_PAYMENT_URL ||
            DEFAULT_OPAY_PAYMENT_URL
        ).trim();
    }
    return DEFAULT_OPAY_PAYMENT_URL.trim();
}

/**
 * @param {boolean} encryptTypeMd5 - EncryptType=0 或未給 EncryptType（32 碼 MAC）時用 MD5
 */
function genOpayCheckMacValue(params, HashKey, HashIV, encryptTypeMd5 = false) {
    const hashKey = (HashKey || '').trim();
    const hashIV = (HashIV || '').trim();
    const data = { ...params };
    delete data.CheckMacValue;

    const sortedParams = Object.keys(data)
        .sort()
        .reduce((r, k) => ({ ...r, [k]: data[k] }), {});

    const query = qs.stringify(sortedParams, { encode: false });

    let raw = `HashKey=${hashKey}&${query}&HashIV=${hashIV}`;

    raw = encodeURIComponent(raw)
        .toLowerCase()
        .replace(/%20/g, '+')
        .replace(/%21/g, '!')
        .replace(/%28/g, '(')
        .replace(/%29/g, ')')
        .replace(/%2a/g, '*');

    const algo = encryptTypeMd5 ? 'md5' : 'sha256';

    return crypto.createHash(algo).update(raw).digest('hex').toUpperCase();
}

function verifyOpayReturnCheckMac(body, config) {
    if (!body || !config || !config.hashKey || !config.hashIV) {
        return false;
    }
    const received = body.CheckMacValue;
    if (!received || typeof received !== 'string') {
        return false;
    }
    const hashKey = (config.hashKey || '').trim();
    const hashIV = (config.hashIV || '').trim();

    const copy = { ...body };
    delete copy.CheckMacValue;

    Object.keys(copy).forEach(key => {
        const v = copy[key];
        if (v === undefined || v === null || v === '') {
            delete copy[key];
        }
    });

    try {
        const useMd5 = received.length === 32;
        const expected = genOpayCheckMacValue(copy, hashKey, hashIV, useMd5);
        return expected === received;
    } catch {
        return false;
    }
}

/**
 * 解析 OPay AIO ReturnURL 為 DonationRow（預設不含暱稱／留言，由 handle-opay-success 依預存訂單補上）。
 * @param {Object} reqBody
 * @param {Object} config - { hashKey, hashIV, youtubeDonationAmount?, youtubeDonationMaxPlaySec? }
 * @returns {Object|null}
 */
function parseUrlDonationCallback(reqBody, config) {
    if (!reqBody || reqBody.Data) {
        return null;
    }

    if (!config || !config.hashKey || !config.hashIV) {
        return null;
    }

    if (!verifyOpayReturnCheckMac(reqBody, config)) {
        return null;
    }

    const RtnCode = reqBody.RtnCode;
    const MerchantID = reqBody.MerchantID;
    const TradeAmt = reqBody.TradeAmt;

    if (RtnCode == null || String(RtnCode) !== '1') {
        return null;
    }
    if (!MerchantID || TradeAmt == null) {
        return null;
    }

    const cost = Number(TradeAmt);
    if (!Number.isFinite(cost) || cost <= 0) {
        return null;
    }

    // 回調通常不含綠界式 CustomField；name/message/video 由伺服器預存訂單補上。
    return {
        merchantId: String(MerchantID),
        name: '',
        cost,
        message: '',
        type: ENUM_DONATION_TYPE.OPAY,
    };
}

/**
 * @typedef {object} OpayCredentials
 * @property {string} hashKey
 * @property {string} hashIV
 */

/**
 * 建立 OPay AIO POST 表單參數
 * @param {string} opayMerchantId
 * @param {object} orderData — 與 ecpay createPayment 一致
 * @param {OpayCredentials} credentials
 */
function createPayment(opayMerchantId, orderData, credentials) {
    const hashKey = (credentials.hashKey || '').trim();
    const hashIV = (credentials.hashIV || '').trim();

    const MerchantTradeDate = dayjs().format('YYYY/MM/DD HH:mm:ss');
    const MerchantTradeNo = `OPAY${Date.now()}`.slice(0, 20);

    // OPay（歐付寶）AIO **不支援**綠界的 CustomField1–4，送檢會回「CustomField1 Not In Spec」。
    // 暱稱／全文留言／影音 payload 由建單端寫入 payment_pending_orders，回調再以 fullName/fullMessage/youtubeVideoPayload 串回。

    const base =
        process.env.NODE_ENV === 'production'
            ? process.env.RETURN_URL
            : process.env.RETURN_URL_LOCAL;

    const returnBase = ((base || '') + '').replace(/\/$/, '');

    const data = {
        MerchantID: String(opayMerchantId).trim(),
        MerchantTradeNo,
        MerchantTradeDate,
        PaymentType: 'aio',
        TotalAmount: Math.floor(Number(orderData.amount)) || 0,
        TradeDesc: orderData.description || '觀眾贊助',
        ItemName: orderData.itemName || '贊助',
        ReturnURL: `${returnBase}/api/v1/payment/opay-success`,
        ChoosePayment: 'ALL',
        EncryptType: 1,
        ClientBackURL: returnBase || undefined,
    };

    // 避免 CheckMacValue 對 undefined 計算異常（僅組出有值欄位）
    Object.keys(data).forEach(key => {
        const v = data[key];
        if (v === undefined || v === null || v === '') {
            delete data[key];
        }
    });

    const CheckMacValue = genOpayCheckMacValue(
        data,
        hashKey,
        hashIV,
        false /* EncryptType: 1 = SHA256 */
    );

    const paramsOut = {
        ...data,
        CheckMacValue,
    };

    return {
        params: paramsOut,
        merchantTradeNo: MerchantTradeNo,
        paymentUrl: getOpayPaymentApiUrl(),
    };
}

module.exports = {
    createPayment,
    parseUrlDonationCallback,
    verifyOpayReturnCheckMac,
    genOpayCheckMacValue,
};
