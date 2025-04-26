const axios = require('axios');
const path = require('path');
const crypto = require('crypto');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });

const ecpayConfig = {
    MerchantID: process.env.ECPAY_MERCHANT_ID,
    HashKey: process.env.ECPAY_HASH_KEY,
    HashIV: process.env.ECPAY_HASH_IV,
    DonateApiUrl: 'https://payment.ecpay.com.tw/Broadcaster/CheckDonate',
    PaymentApiUrl: 'https://payment.ecpay.com.tw/Cashier/AioCheckOut/V5',
};

function generateCheckMacValue(data) {
    const keys = Object.keys(data).sort();
    let checkString = '';
    keys.forEach(key => {
        checkString += `${key}=${data[key]}&`;
    });
    checkString = `HashKey=${ecpayConfig.HashKey}&${checkString}HashIV=${ecpayConfig.HashIV}`;
    return crypto
        .createHash('sha256')
        .update(checkString)
        .digest('hex')
        .toUpperCase();
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

async function createPayment(orderData) {
    try {
        const data = {
            MerchantID: ecpayConfig.MerchantID,
            MerchantTradeNo: `ECPAY${Date.now()}`,
            MerchantTradeDate: new Date()
                .toLocaleString('zh-TW', {
                    year: 'numeric',
                    month: '2-digit',
                    day: '2-digit',
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit',
                    hour12: false,
                })
                .replace(/\//g, '/'),
            PaymentType: 'aio',
            TotalAmount: orderData.amount,
            TradeDesc: orderData.description || '備註:',
            ItemName: orderData.itemName || '多少錢',
            ReturnURL: process.env.ECPAY_RETURN_URL,
            ChoosePayment: 'ALL',
            EncryptType: 1,
        };

        data.CheckMacValue = generateCheckMacValue(data);

        const response = await axios.post(ecpayConfig.PaymentApiUrl, data, {
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
        });

        return response.data;
    } catch (error) {
        console.error('建立付款訂單失敗:', error);
        throw error;
    }
}

module.exports = {
    getEcPayDonations,
    createPayment,
};
