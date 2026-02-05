/**
 * PayUni payment provider stub.
 * TODO: Implement when integrating PayUni. See https://docs.payuni.com.tw/web/#/7/24
 *
 * Expected interface:
 * - parseDonationCallback(rawBody, config) -> DonationRow | null
 * - validateSignature(data, config) -> boolean (optional)
 */

function parseDonationCallback() {
    throw new Error(
        'PayUni not implemented yet. TODO: 依文件 https://docs.payuni.com.tw/web/#/7/24 實作'
    );
}

module.exports = {
    parseDonationCallback,
};
