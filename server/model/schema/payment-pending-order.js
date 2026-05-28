const { DataTypes } = require('sequelize');
const sequelize = require('../../config/database');

const PaymentPendingOrder = sequelize.define(
    'PaymentPendingOrder',
    {
        merchantTradeNo: {
            type: DataTypes.STRING(50),
            primaryKey: true,
            allowNull: false,
            field: 'merchant_trade_no',
        },
        kind: {
            type: DataTypes.STRING(30),
            allowNull: false,
            defaultValue: '',
        },
        meta: {
            type: DataTypes.JSONB,
            allowNull: false,
            defaultValue: {},
        },
        created_at: {
            type: DataTypes.DATE,
            allowNull: false,
            defaultValue: DataTypes.NOW,
            field: 'created_at',
        },
        expires_at: {
            type: DataTypes.DATE,
            allowNull: false,
            field: 'expires_at',
        },
    },
    {
        tableName: 'payment_pending_orders',
        timestamps: false,
        indexes: [
            {
                name: 'idx_payment_pending_orders_expires',
                fields: ['expires_at'],
            },
        ],
    }
);

module.exports = PaymentPendingOrder;
