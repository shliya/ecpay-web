const donationModel = require('../model/donation');

async function getDonationsByMerchantId(merchantId) {
    return donationModel.findAll({
        where: { merchantId },
        order: [['cost', 'DESC']],
    });
}

async function createDonation(row, { transaction } = {}) {
    return donationModel.create(row, { transaction });
}
module.exports = {
    getDonationsByMerchantId,
    createDonation,
};
