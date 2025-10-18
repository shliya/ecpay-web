const { Op } = require('sequelize');
const ichibanCardModel = require('../model/ichiban-card');
const sequelize = require('../config/database');

async function batchCreateIchibanCards(rows, { transaction } = {}) {
    return ichibanCardModel.bulkCreate(rows, { transaction });
}

function getTransaction() {
    return sequelize.transaction();
}

module.exports = {
    getTransaction,
    batchCreateIchibanCards,
};
