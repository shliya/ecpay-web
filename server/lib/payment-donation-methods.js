/**
 * 斗內／贊助建單：僅開放信用卡、Apple Pay、行動支付
 * （ATM、超商等其餘方式隱藏）
 *
 * 綠界與歐付寶 IgnorePayment 可用值不同，須分開設定。
 * PAYUNi UPP 支付方式欄位須用官方 PascalCase（見 PAYUNi_for_WooCommerce）。
 */

/** 綠界 AIO：隱藏 ATM／超商／BNPL 等（保留 Credit、ApplePay、TWQR） */
const ECPAY_DONATION_IGNORE_PAYMENT =
    'WebATM#ATM#CVS#BARCODE#BNPL#WeiXin#DigitalPayment';

/**
 * 歐付寶 AIO：僅能帶官方列舉值，否則 IgnorePayment Error
 * @see https://developers.opay.tw/AioCreditCard/CreateOrder
 */
const OPAY_DONATION_IGNORE_PAYMENT =
    'WebATM#ATM#CVS#BARCODE#Tenpay#TopUpUsed';

/**
 * @returns {{ ChoosePayment: string, IgnorePayment: string }}
 */
function getEcpayDonationPaymentFields() {
    return {
        ChoosePayment: 'ALL',
        IgnorePayment: ECPAY_DONATION_IGNORE_PAYMENT,
    };
}

/**
 * @returns {{ ChoosePayment: string, IgnorePayment: string }}
 */
function getOpayDonationPaymentFields() {
    return {
        ChoosePayment: 'ALL',
        IgnorePayment: OPAY_DONATION_IGNORE_PAYMENT,
    };
}

/**
 * PAYUNi UPP EncryptInfo：僅帶要啟用的方式 = 1（勿用 CREDIT 全大寫，會被忽略）
 * 未列出的方式（ATM、CVS、CreditInst 分期等）不應出現
 * @returns {Record<string, number>}
 */
function getPayuniDonationPaymentFlags() {
    return {
        Credit: 1,
        ApplePay: 1,
        LinePay: 1,
    };
}

/** @deprecated 請改用 getEcpayDonationPaymentFields / getOpayDonationPaymentFields */
function getAioDonationPaymentFields() {
    return getEcpayDonationPaymentFields();
}

module.exports = {
    ECPAY_DONATION_IGNORE_PAYMENT,
    OPAY_DONATION_IGNORE_PAYMENT,
    getEcpayDonationPaymentFields,
    getOpayDonationPaymentFields,
    getAioDonationPaymentFields,
    getPayuniDonationPaymentFlags,
};
