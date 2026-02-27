const axios = require('axios');
const path = require('path');
const crypto = require('crypto');
const dayjs = require('dayjs');
const qs = require('qs');
const { getEcpayConfigByMerchantId } = require('../../store/ecpay-config');
const { decryptDataAndUrlDecode } = require('../../service/decrypt');
const { ENUM_DONATION_TYPE } = require('../enum');

require('dotenv').config({ path: path.resolve(__dirname, '../../../.env') });

const ecpayConfig = {
    DonateApiUrl: 'https://payment.ecpay.com.tw/Broadcaster/CheckDonate',
    PaymentApiUrl:
        process.env.NODE_ENV === 'production'
            ? process.env.ECPAY_PAYMENT_URL
            : 'https://payment-stage.ecpay.com.tw/Cashier/AioCheckOut/V5',
};

function genCheckMacValue(params, HashKey, HashIV) {
    const sortedParams = Object.keys(params)
        .sort()
        .reduce((r, k) => ({ ...r, [k]: params[k] }), {});

    const query = qs.stringify(sortedParams, { encode: false });

    let raw = `HashKey=${HashKey}&${query}&HashIV=${HashIV}`;

    raw = encodeURIComponent(raw)
        .toLowerCase()
        .replace(/%20/g, '+')
        .replace(/%21/g, '!')
        .replace(/%28/g, '(')
        .replace(/%29/g, ')')
        .replace(/%2a/g, '*');

    const hash = crypto
        .createHash('sha256')
        .update(raw)
        .digest('hex')
        .toUpperCase();

    return hash;
}

/**
 * 驗證綠界 ReturnURL 回傳的 CheckMacValue（特店必須驗證以確認通知來自綠界）
 * @param {Object} body - 綠界 POST 的 body（含 CheckMacValue）
 * @param {Object} config - { hashKey, hashIV }
 * @returns {boolean}
 */
function verifyEcpayReturnCheckMac(body, config) {
    if (!body || !config || !config.hashKey || !config.hashIV) {
        return false;
    }
    const received = body.CheckMacValue;
    if (!received) {
        return false;
    }
    const copy = { ...body };
    delete copy.CheckMacValue;
    const expected = genCheckMacValue(
        copy,
        (config.hashKey || '').trim(),
        (config.hashIV || '').trim()
    );
    return expected === received;
}

/**
 * Parse ECPay donation callback body into unified donation row.
 * @param {Object} reqBody - { Data, TransCode, TransMsg }
 * @param {Object} config - { hashKey, hashIV }
 * @returns {Object|null} DonationRow or null if not success
 */
function parseDonationCallback(reqBody, config) {
    const { Data } = reqBody;

    if (!Data) {
        return null;
    }

    const hashKey = (config.hashKey || '').trim();
    const hashIV = (config.hashIV || '').trim();

    const decrypted = decryptDataAndUrlDecode(Data, hashKey, hashIV);

    if (!decrypted) {
        return null;
    }

    const { RtnCode, MerchantID, OrderInfo, PatronName, PatronNote } =
        decrypted;

    if (RtnCode !== 1) {
        return null;
    }

    const tradeAmt = OrderInfo?.TradeAmt;

    if (tradeAmt == null) {
        return null;
    }

    return {
        merchantId: MerchantID,
        name: PatronName || '',
        cost: Number(tradeAmt),
        message: PatronNote || '',
        type: ENUM_DONATION_TYPE.ECPAY,
    };
}

/**
 * Parse ECPay 網址斗內回調（明文格式，無 Data 加密欄位）.
 * 回調欄位範例: MerchantID, MerchantTradeNo, RtnCode, TradeAmt, CustomField1, CustomField2, ...
 * @param {Object} reqBody - 明文 body（無 Data）
 * @param {Object} [config] - 選填 { hashKey, hashIV }，有則驗證 CheckMacValue
 * @returns {Object|null} DonationRow or null
 */
function parseUrlDonationCallback(reqBody, config) {
    if (!reqBody || reqBody.Data) {
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

    if (config && config.hashKey && config.hashIV) {
        const receivedCheckMac = reqBody.CheckMacValue;
        if (receivedCheckMac) {
            const copy = { ...reqBody };
            delete copy.CheckMacValue;
            const expected = genCheckMacValue(
                copy,
                (config.hashKey || '').trim(),
                (config.hashIV || '').trim()
            );
            if (expected !== receivedCheckMac) {
                return null;
            }
        }
    }

    return {
        merchantId: String(MerchantID),
        name:
            (reqBody.CustomField1 && String(reqBody.CustomField1).trim()) || '',
        cost,
        message:
            (reqBody.CustomField2 && String(reqBody.CustomField2).trim()) || '',
        type: ENUM_DONATION_TYPE.ECPAY,
    };
}

async function getEcPayDonations(ecPayKey) {
    const url = `${ecpayConfig.DonateApiUrl}/${ecPayKey}`;
    const response = await axios.post(url);

    if (!response.data || response.data.error) {
        throw new Error(response.data.error || '無法取得打賞資訊');
    }

    return response.data.map(donation => ({
        donateId: donation.donateid,
        name: donation.name,
        amount: donation.amount,
        message: donation.msg,
        timestamp: new Date().toISOString(),
    }));
}

async function createPayment(merchantId, orderData) {
    const MerchantTradeDate = dayjs().format('YYYY/MM/DD HH:mm:ss');
    const MerchantTradeNo = `ECPAY${Date.now()}`;
    const { hashKey, hashIV } = await getEcpayConfigByMerchantId(merchantId);

    const custom1 =
        orderData.name != null && String(orderData.name).trim()
            ? String(orderData.name).trim().slice(0, 50)
            : '';
    const custom2 =
        orderData.message != null && String(orderData.message).trim()
            ? String(orderData.message).trim().slice(0, 50)
            : '';

    const data = {
        MerchantID: merchantId,
        MerchantTradeNo,
        MerchantTradeDate,
        PaymentType: 'aio',
        TotalAmount: orderData.amount,
        TradeDesc: orderData.description || '一番賞活動',
        ItemName: orderData.itemName || '卡片',
        ...(custom1 !== '' && { CustomField1: custom1 }),
        ...(custom2 !== '' && { CustomField2: custom2 }),
        ReturnURL: (() => {
            const base =
                process.env.NODE_ENV === 'production'
                    ? process.env.RETURN_URL
                    : process.env.RETURN_URL_LOCAL;
            return `${(base || '').replace(/\/$/, '')}/api/v1/payment/ecpay-success`;
        })(),
        ChoosePayment: 'ALL',
        EncryptType: 1,
        ClientBackURL: (() => {
            const base =
                process.env.NODE_ENV === 'production'
                    ? process.env.RETURN_URL
                    : process.env.RETURN_URL_LOCAL;
            return (base || '').replace(/\/$/, '');
        })(),
    };

    data.CheckMacValue = genCheckMacValue(data, hashKey, hashIV);

    return {
        params: data,
        merchantTradeNo: MerchantTradeNo,
        paymentUrl: ecpayConfig.PaymentApiUrl,
    };
}

module.exports = {
    parseDonationCallback,
    parseUrlDonationCallback,
    getEcPayDonations,
    createPayment,
    verifyEcpayReturnCheckMac,
};
