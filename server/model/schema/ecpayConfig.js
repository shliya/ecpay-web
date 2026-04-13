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
            unique: true,
        },
        hashIV: {
            type: DataTypes.STRING(100),
            allowNull: true,
            unique: true,
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
            unique: true,
        },
        payuniHashKey: {
            type: DataTypes.STRING(100),
            allowNull: true,
            field: 'payuniHashKey',
            unique: true,
        },
        payuniHashIV: {
            type: DataTypes.STRING(100),
            allowNull: true,
            field: 'payuniHashIV',
            unique: true,
        },
        totpSecret: {
            type: DataTypes.STRING(255),
            allowNull: true,
            field: 'totpSecret',
        },
        totpEnabled: {
            type: DataTypes.BOOLEAN,
            allowNull: true,
            defaultValue: false,
            field: 'totpEnabled',
        },
        rebindAllowedUntil: {
            type: DataTypes.DATE,
            allowNull: true,
            field: 'rebindAllowedUntil',
        },
        blockedKeywords: {
            type: DataTypes.JSON,
            allowNull: true,
            field: 'blockedKeywords',
            defaultValue: [],
        },
        ecpayEnabled: {
            type: DataTypes.BOOLEAN,
            allowNull: true,
            defaultValue: true,
            field: 'ecpayEnabled',
        },
        payuniEnabled: {
            type: DataTypes.BOOLEAN,
            allowNull: true,
            defaultValue: true,
            field: 'payuniEnabled',
        },
        youtubeDonationEnabled: {
            type: DataTypes.BOOLEAN,
            allowNull: true,
            defaultValue: false,
            field: 'youtubeDonationEnabled',
        },
        youtubeDonationAmount: {
            type: DataTypes.INTEGER,
            allowNull: true,
            defaultValue: 30,
            field: 'youtubeDonationAmount',
        },
        youtubeDonationMaxPlaySec: {
            type: DataTypes.INTEGER,
            allowNull: true,
            defaultValue: 30,
            field: 'youtubeDonationMaxPlaySec',
        },
    },
    {
        tableName: 'ecpay_config',
        timestamps: false, // 若資料表沒有 updated_at、created_at 欄位自動維護，請設為 false
    }
);

module.exports = EcpayConfig;
