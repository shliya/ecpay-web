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
            allowNull: true,
            field: 'merchantId',
            unique: true,
        },
        hashKey: {
            type: DataTypes.STRING(100),
            allowNull: true,
        },
        hashIV: {
            type: DataTypes.STRING(100),
            allowNull: true,
        },
        youtubeChannelHandle: {
            type: DataTypes.STRING(100),
            allowNull: true,
            field: 'youtubeChannelHandle',
        },
        youtubeChannelId: {
            type: DataTypes.STRING(100),
            allowNull: true,
            field: 'youtubeChannelId',
        },
        displayName: {
            type: DataTypes.STRING(100),
            allowNull: true,
            field: 'displayName',
            unique: true,
        },
        themeColors: {
            type: DataTypes.JSON,
            allowNull: true,
            field: 'themeColors',
        },
        created_at: {
            type: DataTypes.DATE,
            allowNull: true,
            defaultValue: DataTypes.NOW,
            field: 'created_at',
        },
        payuniMerchantId: {
            type: DataTypes.STRING(100),
            allowNull: true,
            field: 'payuniMerchantId',
        },
        payuniHashKey: {
            type: DataTypes.STRING(100),
            allowNull: true,
            field: 'payuniHashKey',
        },
        payuniHashIV: {
            type: DataTypes.STRING(100),
            allowNull: true,
            field: 'payuniHashIV',
        },
    },
    {
        tableName: 'ecpay_config',
        timestamps: false, // 若資料表沒有 updated_at、created_at 欄位自動維護，請設為 false
    }
);

module.exports = EcpayConfig;
