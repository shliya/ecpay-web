const { Op } = require('sequelize');
const ichibanCardModel = require('../model/ichiban-card');
const ichibanPrizeModel = require('../model/ichiban-prize');
const sequelize = require('../config/database');

async function batchCreateIchibanCards(rows, { transaction } = {}) {
    return ichibanCardModel.bulkCreate(rows, { transaction });
}

function getTransaction() {
    return sequelize.transaction();
}

async function getIchibanCardByEventIdAndCardIndexAndStatusWithoutInclude(
    eventId,
    cardIndex,
    status,
    { transaction, lock = false } = {}
) {
    return ichibanCardModel.findOne({
        where: { eventId, cardIndex, status: status },
        transaction,
        lock,
    });
}

async function getIchibanCardByEventIdAndCardIndexAndStatus(
    eventId,
    cardIndex,
    status,
    { transaction, lock = false } = {}
) {
    return ichibanCardModel.findOne({
        where: { eventId, cardIndex, status: status },
        include: [
            {
                model: ichibanPrizeModel,
                as: 'prize',
            },
        ],
        transaction,
        lock,
    });
}

async function updateIchibanCardByIdAndStatus(
    id,
    { status, openedAt, openedBy },
    { transaction } = {}
) {
    return ichibanCardModel.update(
        { status, openedAt, openedBy },
        { where: { id }, transaction }
    );
}

module.exports = {
    getTransaction,
    batchCreateIchibanCards,
    getIchibanCardByEventIdAndCardIndexAndStatus,
    getIchibanCardByEventIdAndCardIndexAndStatusWithoutInclude,
    updateIchibanCardByIdAndStatus,
};
