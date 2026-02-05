const { ENUM_DONATION_TYPE } = require('../enum');

/**
 * Unified donation row shape for createDonation(row).
 * All payment providers must parse/normalize to this shape.
 *
 * @typedef {Object} DonationRow
 * @property {string} merchantId
 * @property {string} name
 * @property {number} cost - integer, TWD
 * @property {string} message
 * @property {number} type - ENUM_DONATION_TYPE
 */

function getDonationRowShape() {
    return {
        merchantId: '',
        name: '',
        cost: 0,
        message: '',
        type: ENUM_DONATION_TYPE.ECPAY,
    };
}

module.exports = {
    ENUM_DONATION_TYPE,
    getDonationRowShape,
};
