const { DataTypes } = require('sequelize');
const sequelize = require('../../config/database');

const IchibanPrize = sequelize.define(
    'IchibanPrize',
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
        prizeName: {
            type: DataTypes.STRING(100),
            allowNull: false,
            field: 'prize_name',
        },
        quantity: {
            type: DataTypes.INTEGER,
            allowNull: false,
            defaultValue: 1,
        },
        createdAt: {
            type: DataTypes.DATE,
            allowNull: false,
            defaultValue: DataTypes.NOW,
            field: 'created_at',
        },
    },
    {
        tableName: 'ichiban_prizes',
        timestamps: false,
        indexes: [
            {
                name: 'idx_event_id',
                fields: ['event_id'],
            },
        ],
    }
);

module.exports = IchibanPrize;
