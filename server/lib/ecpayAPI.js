const axios = require('axios');
const path = require('path');
const crypto = require('crypto');
const dayjs = require('dayjs');
const qs = require('qs');
const { getEcpayConfigByMerchantId } = require('../store/ecpay-config');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

const ecpayConfig = {
    DonateApiUrl: 'https://payment.ecpay.com.tw/Broadcaster/CheckDonate',
    PaymentApiUrl:
        process.env.NODE_ENV === 'production'
            ? process.env.ECPAY_PAYMENT_API_URL
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

async function getEcPayDonations(ecPayKey) {
    try {
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
    } catch (error) {
        console.error('get ecpay error', error);
        throw error;
    }
}

async function createPayment(merchantId, orderData) {
    try {
        const MerchantTradeDate = dayjs().format('YYYY/MM/DD HH:mm:ss');
        const MerchantTradeNo = `ECPAY${Date.now()}`;
        const { hashKey, hashIV } =
            await getEcpayConfigByMerchantId(merchantId);

        const data = {
            MerchantID: merchantId,
            MerchantTradeNo,
            MerchantTradeDate,
            PaymentType: 'aio',
            TotalAmount: orderData.amount,
            TradeDesc: orderData.description || '一番賞活動',
            ItemName: orderData.itemName || '卡片',
            ReturnURL:
                process.env.NODE_ENV === 'production'
                    ? `${process.env.ECPAY_RETURN_URL}/api/v1/payment/ecpay-success`
                    : 'https://a91f6501d7b6.ngrok-free.app/api/v1/payment/ecpay-success',
            ChoosePayment: 'ALL',
            EncryptType: 1,
            ClientBackURL:
                process.env.NODE_ENV === 'production'
                    ? `${process.env.ECPAY_RETURN_URL}`
                    : 'https://a91f6501d7b6.ngrok-free.app',
        };

        data.CheckMacValue = genCheckMacValue(data, hashKey, hashIV);

        // 回傳付款參數和訂單號
        return {
            params: data,
            merchantTradeNo: MerchantTradeNo,
            paymentUrl: ecpayConfig.PaymentApiUrl,
        };
    } catch (error) {
        console.error('建立付款訂單失敗:', error);
        throw error;
    }
}

module.exports = {
    getEcPayDonations,
    createPayment,
};
