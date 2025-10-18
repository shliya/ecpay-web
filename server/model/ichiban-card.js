const IchibanEvent = require('./schema/ichiban-event');
const IchibanCard = require('./schema/ichiban-card');
const IchibanPrize = require('./schema/ichiban-prize');

IchibanCard.belongsTo(IchibanEvent, {
    foreignKey: 'eventId',
    targetKey: 'id',
    as: 'event',
});

IchibanCard.belongsTo(IchibanPrize, {
    foreignKey: 'prizeId',
    targetKey: 'id',
    as: 'prize',
});

module.exports = IchibanCard;
