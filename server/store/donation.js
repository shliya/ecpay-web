const { Op } = require('sequelize');
const donationModel = require('../model/donation');

async function getDonationsByMerchantId(merchantId) {
    return donationModel.findAll({
        where: { merchantId },
        order: [['created_at', 'DESC']],
    });
}

async function getDonationsByMerchantIdAndDate(
    merchantId,
    { startDate, endDate } = {}
) {
    return donationModel.findAll({
        where: {
            merchantId,
            created_at: { [Op.between]: [startDate, endDate] },
        },
        order: [['created_at', 'DESC']],
    });
}

async function createDonation(row, { transaction } = {}) {
    return donationModel.create(row, { transaction });
}

module.exports = {
    getDonationsByMerchantId,
    getDonationsByMerchantIdAndDate,
    createDonation,
};
