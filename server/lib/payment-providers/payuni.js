const crypto = require('crypto');
const path = require('path');
const querystring = require('querystring');
const { ENUM_DONATION_TYPE } = require('../enum'); // 記得在 enum 加上 PAYUNI

require('dotenv').config({ path: path.resolve(__dirname, '../../../.env') });

const payuniConfig = {
    ApiUrl:
        process.env.NODE_ENV === 'production'
            ? 'https://api.payuni.com.tw/api/upp'
            : 'https://sandbox-api.payuni.com.tw/api/upp',
    Version: '2.0',
};

function aesEncrypt(plainText, hashKey, hashIV) {
    const cipher = crypto.createCipheriv('aes-256-gcm', hashKey, hashIV);

    let cipherText = cipher.update(plainText, 'utf8', 'base64');
    cipherText += cipher.final('base64');

    const tag = cipher.getAuthTag().toString('base64');
    return Buffer.from(`${cipherText}:::${tag}`).toString('hex').trim();
}

function aesDecrypt(encryptInfo, hashKey, hashIV) {
    const [encryptData, tag] = Buffer.from(encryptInfo, 'hex')
        .toString()
        .split(':::');

    const decipher = crypto.createDecipheriv('aes-256-gcm', hashKey, hashIV);
    decipher.setAuthTag(Buffer.from(tag, 'base64'));

    let decipherText = decipher.update(encryptData, 'base64', 'utf8');
    decipherText += decipher.final('utf8');

    return decipherText;
}

function genHashInfo(encryptInfo, hashKey, hashIV) {
    const hash = crypto
        .createHash('sha256')
        .update(`${hashKey}${encryptInfo}${hashIV}`);
    return hash.digest('hex').toUpperCase();
}

/**
 * 建立 PAYUNi 付款參數
 */
function createPayment(merchantId, orderData, { hashKey, hashIV }) {
    const MerchantTradeNo = `PAYUNI${Date.now()}`.slice(0, 20); // PAYUNi 建議 20 碼內

    const baseUrl =
        process.env.NODE_ENV === 'production'
            ? process.env.RETURN_URL
            : process.env.RETURN_URL_LOCAL;
    const base = (baseUrl || '').replace(/\/$/, '');

    const safeName = encodeURIComponent(orderData.name);
    const safeMsg = encodeURIComponent(orderData.message);

    const payload = {
        MerID: merchantId,
        MerTradeNo: MerchantTradeNo,
        TradeAmt: Math.floor(Number(orderData.amount)) || 0,
        Timestamp: Math.floor(Date.now() / 1000),
        ProdDesc: orderData.description || '斗內贊助',
        NotifyURL: `${base}/api/v1/comme/payuni/id=${merchantId}?name=${safeName}&msg=${safeMsg}`, // 背景回調
    };

    const EncryptInfo = aesEncrypt(
        querystring.stringify(payload),
        hashKey,
        hashIV
    );
    const HashInfo = genHashInfo(EncryptInfo, hashKey, hashIV);

    return {
        params: {
            MerID: merchantId,
            Version: payuniConfig.Version,
            EncryptInfo,
            HashInfo,
        },
        merchantTradeNo: MerchantTradeNo,
        paymentUrl: payuniConfig.ApiUrl,
    };
}

/**
 * 統一解析 PAYUNi 回調並回傳 DonationRow
 */
function parseDonationCallback(reqBody, reqQuery, config) {
    const { EncryptInfo, HashInfo } = reqBody;
    const { name, msg } = reqQuery;
    if (
        !EncryptInfo ||
        !HashInfo ||
        !config ||
        !config.hashKey ||
        !config.hashIV
    ) {
        return null;
    }

    const hashKey = (config.hashKey || '').trim();
    const hashIV = (config.hashIV || '').trim();

    const expectedHash = genHashInfo(EncryptInfo, hashKey, hashIV);
    if (HashInfo !== expectedHash) {
        return null; // 驗證失敗
    }

    // 2. 解密
    try {
        const decryptedStr = aesDecrypt(EncryptInfo, hashKey, hashIV);
        const data = querystring.parse(decryptedStr);

        if (data.TradeStatus !== '1' || data.Status !== 'SUCCESS') {
            return null; // 交易失敗或未完成
        }

        const tradeAmt = data.TradeAmt;
        if (tradeAmt == null) {
            return null;
        }

        return {
            merchantId: data.MerID,
            name: name || '',
            cost: Number(tradeAmt),
            message: msg || '',
            type: ENUM_DONATION_TYPE.PAYUNI,
            ecpayConfigId: config.ecpayConfigId,
        };
    } catch (error) {
        console.error('PAYUNi 解密或解析失敗:', error);
        return null;
    }
}

module.exports = {
    createPayment,
    parseDonationCallback,
};
