const { DataTypes } = require('sequelize');
const sequelize = require('../../config/database');

const EcpayConfig = sequelize.define(
    'EcpayConfig',
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
            field: 'merchantId',
            unique: true,
        },
        hashKey: {
            type: DataTypes.STRING(100),
            allowNull: false,
        },
        hashIV: {
            type: DataTypes.STRING(100),
            allowNull: false,
        },
        created_at: {
            type: DataTypes.DATE,
            allowNull: true,
            defaultValue: DataTypes.NOW,
            field: 'created_at',
        },
    },
    {
        tableName: 'ecpay_config',
        timestamps: false, // 若資料表沒有 updated_at、created_at 欄位自動維護，請設為 false
    }
);

module.exports = EcpayConfig;
