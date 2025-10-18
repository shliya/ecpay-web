const { DataTypes } = require('sequelize');
const sequelize = require('../../config/database');
const { ENUM_ICHIBAN_EVENT_STATUS } = require('../../lib/enum');

const IchibanEvent = sequelize.define(
    'IchibanEvent',
    {
        id: {
            type: DataTypes.BIGINT,
            primaryKey: true,
            autoIncrement: true,
            allowNull: false,
        },
        merchantId: {
            type: DataTypes.STRING(50),
            allowNull: false,
            field: 'merchant_id',
        },
        eventName: {
            type: DataTypes.STRING(100),
            allowNull: false,
            field: 'event_name',
        },
        description: {
            type: DataTypes.TEXT,
            allowNull: true,
        },
        totalCards: {
            type: DataTypes.INTEGER,
            allowNull: false,
            defaultValue: 0,
            field: 'total_cards',
        },
        openedCards: {
            type: DataTypes.INTEGER,
            allowNull: false,
            defaultValue: 0,
            field: 'opened_cards',
        },
        status: {
            type: DataTypes.SMALLINT,
            allowNull: false,
            defaultValue: ENUM_ICHIBAN_EVENT_STATUS.ACTIVE,
            validate: {
                isIn: {
                    args: [Object.values(ENUM_ICHIBAN_EVENT_STATUS)],
                    msg: '狀態錯誤',
                },
            },
        },
        startTime: {
            type: DataTypes.DATE,
            allowNull: true,
            field: 'start_time',
        },
        endTime: {
            type: DataTypes.DATE,
            allowNull: true,
            field: 'end_time',
        },
        createdAt: {
            type: DataTypes.DATE,
            allowNull: false,
            defaultValue: DataTypes.NOW,
            field: 'created_at',
        },
        updatedAt: {
            type: DataTypes.DATE,
            allowNull: false,
            defaultValue: DataTypes.NOW,
            field: 'updated_at',
        },
    },
    {
        tableName: 'ichiban_events',
        timestamps: false,
        indexes: [
            {
                name: 'idx_merchant_id',
                fields: ['merchant_id'],
            },
            {
                name: 'idx_status',
                fields: ['status'],
            },
        ],
    }
);

module.exports = IchibanEvent;
