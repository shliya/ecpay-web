const sequelize = require('../config/database');
const { Op } = require('sequelize');
const FundraisingEvents = require('../model/fundraising-events');
const { ENUM_FUNDRAISING_EVENT_STATUS } = require('../lib/enum');
const { getEcpayConfigByMerchantId } = require('./ecpay-config');

async function resolveEcpayConfigId(merchantId) {
    if (!merchantId) return null;
    const config = await getEcpayConfigByMerchantId(merchantId.trim());
    return config ? config.id : null;
}

async function getActiveFundraisingEventsByMerchantId(merchantId) {
    const ecpayConfigId = await resolveEcpayConfigId(merchantId);
    if (ecpayConfigId == null) return [];
    return getActiveFundraisingEventsByEcpayConfigId(ecpayConfigId);
}

async function getActiveFundraisingEventsByEcpayConfigId(ecpayConfigId) {
    return FundraisingEvents.findAll({
        where: {
            ecpayConfigId,
            status: {
                [Op.or]: [
                    ENUM_FUNDRAISING_EVENT_STATUS.ACTIVE,
                    ENUM_FUNDRAISING_EVENT_STATUS.PAUSE,
                ],
            },
        },
        order: [['created_at', 'DESC']],
    });
}

async function createFundraisingEvent(row, { transaction } = {}) {
    const resolved = { ...row };
    if (resolved.ecpayConfigId == null && resolved.merchantId) {
        const id = await resolveEcpayConfigId(resolved.merchantId);
        if (id != null) resolved.ecpayConfigId = id;
    }
    return FundraisingEvents.create(resolved, { transaction });
}

function getTransaction() {
    return sequelize.transaction();
}

async function getFundraisingEventByIdAndMerchantId(id, merchantId) {
    const ecpayConfigId = await resolveEcpayConfigId(merchantId);
    if (ecpayConfigId == null) return null;
    return getFundraisingEventByIdAndEcpayConfigId(id, ecpayConfigId);
}

async function getFundraisingEventByIdAndEcpayConfigId(id, ecpayConfigId) {
    return FundraisingEvents.findOne({
        where: {
            id,
            ecpayConfigId,
        },
    });
}

async function updateFundraisingEventByIdAndMerchantId(
    id,
    merchantId,
    { cost, type, eventName }
) {
    const ecpayConfigId = await resolveEcpayConfigId(merchantId);
    if (ecpayConfigId == null) return [0];
    return updateFundraisingEventByIdAndEcpayConfigId(id, ecpayConfigId, {
        cost,
        type,
        eventName,
    });
}

async function updateFundraisingEventByIdAndEcpayConfigId(
    id,
    ecpayConfigId,
    { cost, type, eventName }
) {
    const where = {
        id,
        ecpayConfigId,
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
    const ecpayConfigId = await resolveEcpayConfigId(merchantId);
    if (ecpayConfigId == null) return [0];
    return batchUpdateFundraisingEventByEcpayConfigId(ecpayConfigId, {
        cost,
        type,
    });
}

async function batchUpdateFundraisingEventByEcpayConfigId(
    ecpayConfigId,
    { cost, type }
) {
    const where = {
        ecpayConfigId,
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
    const ecpayConfigId = await resolveEcpayConfigId(merchantId);
    if (ecpayConfigId == null) return [0];
    return disableFundraisingEventByIdAndEcpayConfigId(id, ecpayConfigId);
}

async function disableFundraisingEventByIdAndEcpayConfigId(id, ecpayConfigId) {
    const where = {
        id,
        ecpayConfigId,
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
    const ecpayConfigId = await resolveEcpayConfigId(merchantId);
    if (ecpayConfigId == null) return [0];
    return enableFundraisingEventByIdAndEcpayConfigId(id, ecpayConfigId);
}

async function enableFundraisingEventByIdAndEcpayConfigId(id, ecpayConfigId) {
    const where = {
        id,
        ecpayConfigId,
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

async function pauseFundraisingEventByIdAndMerchantId(id, merchantId) {
    const ecpayConfigId = await resolveEcpayConfigId(merchantId);
    if (ecpayConfigId == null) return [0];
    return pauseFundraisingEventByIdAndEcpayConfigId(id, ecpayConfigId);
}

async function pauseFundraisingEventByIdAndEcpayConfigId(id, ecpayConfigId) {
    const where = {
        id,
        ecpayConfigId,
    };
    return FundraisingEvents.update(
        {
            status: ENUM_FUNDRAISING_EVENT_STATUS.PAUSE,
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
    getActiveFundraisingEventsByEcpayConfigId,
    createFundraisingEvent,
    getTransaction,
    getFundraisingEventByIdAndMerchantId,
    getFundraisingEventByIdAndEcpayConfigId,
    updateFundraisingEventByIdAndMerchantId,
    updateFundraisingEventByIdAndEcpayConfigId,
    batchUpdateFundraisingEventByMerchantId,
    batchUpdateFundraisingEventByEcpayConfigId,
    disableFundraisingEventByIdAndMerchantId,
    disableFundraisingEventByIdAndEcpayConfigId,
    enableFundraisingEventByIdAndMerchantId,
    enableFundraisingEventByIdAndEcpayConfigId,
    pauseFundraisingEventByIdAndMerchantId,
    pauseFundraisingEventByIdAndEcpayConfigId,
    expireOutdatedEvents,
};
