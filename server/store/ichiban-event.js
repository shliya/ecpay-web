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
                    ENUM_ICHIBAN_EVENT_STATUS.ENDED,
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
        order: [[{ model: ichibanCardModel, as: 'cards' }, 'cardIndex', 'ASC']],
        attributes: [
            'id',
            'eventName',
            'description',
            'totalCards',
            'openedCards',
            'status',
            'startTime',
            'endTime',
            'cost',
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

async function getIchibanEventById(eventId, { transaction } = {}) {
    return ichibanEventModel.findByPk(eventId, { transaction });
}

async function updateIchibanEventOpenedCards(eventId, { transaction } = {}) {
    return ichibanEventModel.update(
        {
            openedCards: sequelize.literal('opened_cards + 1'),
        },
        {
            where: { id: eventId },
            transaction,
        }
    );
}

async function updateIchibanEventStatus(eventId, status, { transaction } = {}) {
    return ichibanEventModel.update(
        { status },
        {
            where: { id: eventId },
            transaction,
        }
    );
}

async function expireOutdatedEvents() {
    const currentDate = new Date();

    const [updatedRowsCount] = await ichibanEventModel.update(
        {
            status: ENUM_ICHIBAN_EVENT_STATUS.ENDED,
        },
        {
            where: {
                status: ENUM_ICHIBAN_EVENT_STATUS.ACTIVE,
                endMonth: {
                    [Op.lt]: currentDate,
                },
            },
        }
    );

    return updatedRowsCount;
}

module.exports = {
    getTransaction,
    createIchibanEvent,
    getIchibanEventsByMerchantId,
    getIchibanEventByIdAndMerchantId,
    getIchibanEventById,
    updateIchibanEventByIdAndMerchantId,
    updateIchibanEventOpenedCards,
    updateIchibanEventStatus,
    expireOutdatedEvents,
};
