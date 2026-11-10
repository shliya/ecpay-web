const crypto = require('crypto');

/**
 * 產生金流訂單編號（MerchantTradeNo / MerTradeNo）。
 *
 * 原本是 `${prefix}${Date.now()}`，有兩個問題：
 *   1. 可預測：知道建單時間就能把單號猜出來，配合偽造回調可以冒用別人的訂單
 *   2. 會撞號：同一毫秒建立的兩筆訂單單號相同，setPaymentOrder 是 upsert，
 *      後建的會把前一筆的 pending 資料蓋掉
 *
 * 綠界／歐付寶限制 20 碼英數字，PAYUNi 建議 20 碼內，所以統一輸出 20 碼：
 *   前綴 + 隨機大寫英數字補滿。以 ECPAY 為例有 15 碼隨機，約 77 bits，不可能猜中。
 *
 * @param {string} prefix 例如 'ECPAY'、'PAYUNI'、'OPAY'
 * @param {number} [length=20]
 * @returns {string}
 */
const ALPHABET = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';

function generateTradeNo(prefix, length = 20) {
    const head = String(prefix || '').toUpperCase();
    if (!/^[A-Z0-9]*$/.test(head)) {
        throw new Error('訂單編號前綴只能是英數字');
    }
    const randomLength = length - head.length;
    if (randomLength < 12) {
        throw new Error('訂單編號前綴過長，隨機碼不足 12 碼');
    }

    // 用 randomInt 逐字抽，避免取模造成的分布偏差
    let tail = '';
    for (let i = 0; i < randomLength; i += 1) {
        tail += ALPHABET[crypto.randomInt(ALPHABET.length)];
    }
    return `${head}${tail}`;
}

module.exports = { generateTradeNo };
