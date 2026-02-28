const { DataTypes } = require('sequelize');
const sequelize = require('../../config/database');
const {
    ENUM_FUNDRAISING_EVENT_TYPE,
    ENUM_FUNDRAISING_EVENT_STATUS,
} = require('../../lib/enum');

const FundraisingEvents = sequelize.define(
    'FundraisingEvents',
    {
        id: {
            type: DataTypes.BIGINT,
            primaryKey: true,
            autoIncrement: true,
            allowNull: false,
            field: 'id',
        },
        type: {
            type: DataTypes.INTEGER,
            allowNull: false,
            field: 'type',
            defaultValue: ENUM_FUNDRAISING_EVENT_TYPE.UP,
            validate: {
                isIn: {
                    args: [Object.values(ENUM_FUNDRAISING_EVENT_TYPE)],
                    msg: '類型錯誤',
                },
            },
        },
        merchantId: {
            type: DataTypes.STRING(50),
            allowNull: false,
            field: 'merchantId',
        },
        ecpayConfigId: {
            type: DataTypes.BIGINT,
            allowNull: true,
            field: 'ecpayConfigId',
            references: { model: 'ecpay_config', key: 'id' },
        },
        eventName: {
            type: DataTypes.STRING(100),
            allowNull: false,
            field: 'eventName',
        },
        description: {
            type: DataTypes.TEXT,
            allowNull: true,
        },
        startMonth: {
            type: DataTypes.DATE,
            allowNull: false,
            field: 'startMonth',
        },
        endMonth: {
            type: DataTypes.DATE,
            allowNull: false,
            field: 'endMonth',
        },
        status: {
            type: DataTypes.INTEGER,
            allowNull: false,
            defaultValue: ENUM_FUNDRAISING_EVENT_STATUS.ACTIVE,
            field: 'status',
            validate: {
                isIn: {
                    args: [Object.values(ENUM_FUNDRAISING_EVENT_STATUS)],
                    msg: '狀態錯誤',
                },
            },
        },
        totalAmount: {
            type: DataTypes.INTEGER,
            allowNull: false,
            field: 'totalAmount',
        },
        cost: {
            type: DataTypes.INTEGER,
            allowNull: false,
            field: 'cost',
            defaultValue: 0,
        },
        created_at: {
            type: DataTypes.DATE,
            allowNull: false,
            defaultValue: DataTypes.NOW,
            field: 'created_at',
        },
    },
    {
        tableName: 'fundraising_events',
        timestamps: false,
        indexes: [
            {
                name: 'idx_fundraising_events_ecpayConfigId',
                fields: ['ecpayConfigId'],
            },
        ],
    }
);

module.exports = FundraisingEvents;
