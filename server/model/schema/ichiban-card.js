const { DataTypes } = require('sequelize');
const sequelize = require('../../config/database');
const { ENUM_ICHIBAN_CARD_STATUS } = require('../../lib/enum');

const IchibanCard = sequelize.define(
    'IchibanCard',
    {
        id: {
            type: DataTypes.BIGINT,
            primaryKey: true,
            autoIncrement: true,
            allowNull: false,
        },
        eventId: {
            type: DataTypes.BIGINT,
            allowNull: false,
            field: 'event_id',
        },
        cardIndex: {
            type: DataTypes.INTEGER,
            allowNull: false,
            field: 'card_index',
        },
        prizeId: {
            type: DataTypes.BIGINT,
            allowNull: false,
            field: 'prize_id',
        },
        status: {
            type: DataTypes.SMALLINT,
            allowNull: false,
            defaultValue: ENUM_ICHIBAN_CARD_STATUS.ACTIVE,
            field: 'status',
        },
        openedAt: {
            type: DataTypes.DATE,
            allowNull: true,
            field: 'opened_at',
        },
        openedBy: {
            type: DataTypes.STRING(100),
            allowNull: true,
            field: 'opened_by',
        },
        createdAt: {
            type: DataTypes.DATE,
            allowNull: false,
            defaultValue: DataTypes.NOW,
            field: 'created_at',
        },
    },
    {
        tableName: 'ichiban_cards',
        timestamps: false,
        indexes: [
            {
                name: 'idx_event_id',
                fields: ['event_id'],
            },
            {
                name: 'unique_event_card',
                fields: ['event_id', 'card_index'],
                unique: true,
            },
        ],
    }
);

module.exports = IchibanCard;
