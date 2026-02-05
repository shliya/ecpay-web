const { convertToTWD } = require('../currency-converter');
const { ENUM_DONATION_TYPE } = require('../enum');

/**
 * Normalize YouTube Super Chat info to unified donation row.
 * Converts amount to TWD and returns shape for createDonation(row).
 *
 * @param {Object} superChatInfo - output of extractSuperChatInfo(message)
 * @param {string} merchantId
 * @returns {Promise<Object>} DonationRow
 */
async function normalizeToDonation(superChatInfo, merchantId) {
    const originalAmount = superChatInfo.amount;
    const originalCurrency = superChatInfo.currency || 'TWD';
    const convertedTWD = await convertToTWD(originalAmount, originalCurrency);
    const costInTWD = Math.floor(convertedTWD);

    return {
        merchantId,
        name: superChatInfo.displayName || '',
        cost: costInTWD,
        message: superChatInfo.displayMessage || '',
        type: ENUM_DONATION_TYPE.YOUTUBE_SUPER_CHAT,
    };
}

module.exports = {
    normalizeToDonation,
};
