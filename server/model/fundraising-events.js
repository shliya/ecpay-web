const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

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
        merchantId: {
            type: DataTypes.STRING(50),
            allowNull: false,
            field: 'merchantId',
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
            defaultValue: 0,
            field: 'status',
        },
        totalAmount: {
            type: DataTypes.INTEGER,
            allowNull: false,
            field: 'totalAmount',
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
    }
);

module.exports = FundraisingEvents;
