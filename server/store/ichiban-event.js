const { Op } = require('sequelize');
const ichibanEventModel = require('../model/ichiban-event');
const ichibanCardModel = require('../model/ichiban-card');
const ichibanPrizeModel = require('../model/ichiban-prize');
const sequelize = require('../config/database');
const { ENUM_ICHIBAN_EVENT_STATUS } = require('../lib/enum');

async function createIchibanEvent(row, { transaction } = {}) {
    return ichibanEventModel.create(row, { transaction });
}

async function getIchibanEventsByMerchantId(merchantId) {
    return ichibanEventModel.findAll({
        where: {
            merchantId,
            status: {
                [Op.or]: [
                    ENUM_ICHIBAN_EVENT_STATUS.ACTIVE,
                    ENUM_ICHIBAN_EVENT_STATUS.PAUSED,
                ],
            },
        },
        order: [['created_at', 'DESC']],
    });
}

async function getIchibanEventByIdAndMerchantId(id, merchantId) {
    return ichibanEventModel.findOne({
        where: { id, merchantId },
        include: [
            {
                model: ichibanCardModel,
                as: 'cards',
                include: [
                    {
                        model: ichibanPrizeModel,
                        as: 'prize',
                        attributes: ['prizeName'],
                    },
                ],
                attributes: ['cardIndex', 'status', 'openedAt', 'openedBy'],
            },
        ],
        attributes: [
            'id',
            'eventName',
            'description',
            'totalCards',
            'openedCards',
            'status',
            'startTime',
            'endTime',
        ],
    });
}

async function updateIchibanEventByIdAndMerchantId(
    id,
    merchantId,
    { eventName, description, totalCards }
) {
    return ichibanEventModel.update(
        { eventName, description, totalCards },
        {
            where: { id, merchantId },
        }
    );
}

function getTransaction() {
    return sequelize.transaction();
}

module.exports = {
    getTransaction,
    createIchibanEvent,
    getIchibanEventsByMerchantId,
    getIchibanEventByIdAndMerchantId,
    updateIchibanEventByIdAndMerchantId,
};
