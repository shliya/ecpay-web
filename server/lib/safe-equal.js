const crypto = require('crypto');

/**
 * 常數時間比對字串（長度不同也回 false，避免洩漏）
 * @param {string} a
 * @param {string} b
 * @returns {boolean}
 */
function safeEqualString(a, b) {
    const left = Buffer.from(String(a ?? ''), 'utf8');
    const right = Buffer.from(String(b ?? ''), 'utf8');
    if (left.length !== right.length) {
        return false;
    }
    if (left.length === 0) {
        return false;
    }
    return crypto.timingSafeEqual(left, right);
}

module.exports = {
    safeEqualString,
};
