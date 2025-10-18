const IchibanEvent = require('./schema/ichiban-event');
const IchibanPrize = require('./schema/ichiban-prize');
const IchibanCard = require('./schema/ichiban-card');

IchibanPrize.belongsTo(IchibanEvent, {
    foreignKey: 'eventId',
    targetKey: 'id',
    as: 'event',
});

IchibanPrize.hasMany(IchibanCard, {
    foreignKey: 'prizeId',
    sourceKey: 'id',
    as: 'cards',
});

module.exports = IchibanPrize;
