const { Op } = require('sequelize');
const ichibanPrizeModel = require('../model/ichiban-prize');
const sequelize = require('../config/database');

async function batchCreateIchibanPrizes(rows, { transaction } = {}) {
    return ichibanPrizeModel.bulkCreate(rows, { transaction });
}

function getTransaction() {
    return sequelize.transaction();
}

module.exports = {
    getTransaction,
    batchCreateIchibanPrizes,
};
