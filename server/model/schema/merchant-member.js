const { DataTypes } = require('sequelize');
const sequelize = require('../../config/database');

/**
 * Google 帳號與商店（ecpay_config.merchantId）的對應關係。
 *
 * schema 層允許一個 user 對多間商店、一間商店對多個 user；
 * 現階段由應用層限制成單店（見 store/merchant-member.js 的 bindMerchant）。
 */
const MerchantMember = sequelize.define(
    'MerchantMember',
    {
        id: {
            type: DataTypes.BIGINT,
            primaryKey: true,
            autoIncrement: true,
            allowNull: false,
        },
        userId: {
            type: DataTypes.STRING,
            allowNull: false,
            field: 'user_id',
        },
        merchantId: {
            type: DataTypes.STRING(50),
            allowNull: false,
            field: 'merchant_id',
        },
        role: {
            type: DataTypes.STRING(20),
            allowNull: false,
            defaultValue: 'owner',
            field: 'role',
        },
        status: {
            type: DataTypes.STRING(20),
            allowNull: false,
            defaultValue: 'active',
            field: 'status',
        },
        boundVia: {
            type: DataTypes.STRING(20),
            allowNull: true,
            field: 'bound_via',
        },
        created_at: {
            type: DataTypes.DATE,
            allowNull: false,
            defaultValue: DataTypes.NOW,
            field: 'created_at',
        },
        updated_at: {
            type: DataTypes.DATE,
            allowNull: false,
            defaultValue: DataTypes.NOW,
            field: 'updated_at',
        },
    },
    {
        tableName: 'merchant_member',
        timestamps: false,
    }
);

module.exports = MerchantMember;
