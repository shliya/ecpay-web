const sequelize = require('../config/database');
const { Op } = require('sequelize');
const FundraisingEvents = require('../model/fundraising-events');
const { ENUM_FUNDRAISING_EVENT_STATUS } = require('../lib/enum');

async function getActiveFundraisingEventsByMerchantId(merchantId) {
    return FundraisingEvents.findAll({
        where: {
            merchantId,
            status: ENUM_FUNDRAISING_EVENT_STATUS.ACTIVE,
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

async function getFundraisingEventByIdAndMerchantId(id, merchantId) {
    return FundraisingEvents.findOne({
        where: {
            id,
            merchantId,
        },
    });
}

async function updateFundraisingEventByIdAndMerchantId(
    id,
    merchantId,
    { cost, type, eventName }
) {
    const where = {
        id,
        merchantId,
    };
    const update = {};
    if (eventName) {
        update.eventName = eventName;
    }
    if (type) {
        where.type = type;
    }
    if (cost) {
        update.cost = sequelize.literal(`"cost" + ${cost}`);
    }
    return FundraisingEvents.update(update, {
        where,
    });
}

async function batchUpdateFundraisingEventByMerchantId(
    merchantId,
    { cost, type }
) {
    const where = {
        merchantId,
        status: ENUM_FUNDRAISING_EVENT_STATUS.ACTIVE,
    };
    if (type) {
        where.type = type;
    }
    return FundraisingEvents.update(
        {
            cost: sequelize.literal(`"cost" + ${cost}`),
        },
        { where }
    );
}

async function disableFundraisingEventByIdAndMerchantId(id, merchantId) {
    const where = {
        id,
        merchantId,
    };
    return FundraisingEvents.update(
        {
            status: ENUM_FUNDRAISING_EVENT_STATUS.INACTIVE,
        },
        {
            where,
        }
    );
}

async function enableFundraisingEventByIdAndMerchantId(id, merchantId) {
    const where = {
        id,
        merchantId,
    };
    return FundraisingEvents.update(
        {
            status: ENUM_FUNDRAISING_EVENT_STATUS.ACTIVE,
        },
        {
            where,
        }
    );
}

async function expireOutdatedEvents() {
    const currentDate = new Date();

    const [updatedRowsCount] = await FundraisingEvents.update(
        {
            status: ENUM_FUNDRAISING_EVENT_STATUS.INACTIVE,
        },
        {
            where: {
                status: ENUM_FUNDRAISING_EVENT_STATUS.ACTIVE,
                endMonth: {
                    [Op.lt]: currentDate,
                },
            },
        }
    );

    return updatedRowsCount;
}

module.exports = {
    getActiveFundraisingEventsByMerchantId,
    createFundraisingEvent,
    getTransaction,
    getFundraisingEventByIdAndMerchantId,
    updateFundraisingEventByIdAndMerchantId,
    batchUpdateFundraisingEventByMerchantId,
    disableFundraisingEventByIdAndMerchantId,
    enableFundraisingEventByIdAndMerchantId,
    expireOutdatedEvents,
};
