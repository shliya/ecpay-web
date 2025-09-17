const { Op } = require('sequelize');
const donationModel = require('../model/donation');
const sequelize = require('../config/database');

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

function getTransaction() {
    return sequelize.transaction();
}

module.exports = {
    getTransaction,
    getDonationsByMerchantId,
    getDonationsByMerchantIdAndDate,
    createDonation,
};
