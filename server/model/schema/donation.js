const { DataTypes } = require('sequelize');
const sequelize = require('../../config/database');
const { ENUM_DONATION_TYPE } = require('../../lib/enum');

const Donation = sequelize.define(
    'Donation',
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
        name: {
            type: DataTypes.STRING(100),
            allowNull: false,
        },
        cost: {
            type: DataTypes.INTEGER,
            allowNull: false,
        },
        message: {
            type: DataTypes.TEXT,
            allowNull: true,
        },
        type: {
            type: DataTypes.INTEGER,
            allowNull: false,
            defaultValue: ENUM_DONATION_TYPE.ECPAY,
        },
        created_at: {
            type: DataTypes.DATE,
            allowNull: true,
            defaultValue: DataTypes.NOW,
            field: 'created_at',
        },
    },
    {
        tableName: 'donations',
        timestamps: false,
        indexes: [
            {
                name: 'idx_marchantId_createdAt',
                fields: ['merchantId', 'created_at'],
            },
        ],
    }
);

module.exports = Donation;
