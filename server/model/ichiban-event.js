const IchibanPrize = require('./schema/ichiban-prize');
const IchibanEvent = require('./schema/ichiban-event');
const IchibanCard = require('./schema/ichiban-card');

IchibanEvent.hasMany(IchibanPrize, {
    foreignKey: 'eventId',
    sourceKey: 'id',
    as: 'prizes',
});

IchibanEvent.hasMany(IchibanCard, {
    foreignKey: 'eventId',
    sourceKey: 'id',
    as: 'cards',
});

module.exports = IchibanEvent;
