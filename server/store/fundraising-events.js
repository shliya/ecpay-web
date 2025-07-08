const sequelize = require('../config/database');
const FundraisingEvents = require('../model/fundraising-events');

async function getFundraisingEventsByMerchantId(merchantId) {
    return FundraisingEvents.findOne({
        where: {
            merchantId,
            status: 1,
        },
        order: [['created_at', 'DESC']],
    });
}

async function createFundraisingEvent(row, { transaction } = {}) {
    return FundraisingEvents.create(row, { transaction });
}

function getTransaction() {
    return sequelize.transaction();
}

module.exports = {
    getFundraisingEventsByMerchantId,
    createFundraisingEvent,
    getTransaction,
};
