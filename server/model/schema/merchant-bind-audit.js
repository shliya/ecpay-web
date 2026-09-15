const { DataTypes } = require('sequelize');
const sequelize = require('../../config/database');

/**
 * 商店綁定／解綁的稽核紀錄。涉及金流權限，失敗的嘗試也要留下來。
 * 刻意不設外鍵：使用者被刪除後仍須保留歷程。
 */
const MerchantBindAudit = sequelize.define(
    'MerchantBindAudit',
    {
        id: {
            type: DataTypes.BIGINT,
            primaryKey: true,
            autoIncrement: true,
            allowNull: false,
        },
        userId: {
            type: DataTypes.STRING,
            allowNull: true,
            field: 'user_id',
        },
        merchantId: {
            type: DataTypes.STRING(50),
            allowNull: true,
            field: 'merchant_id',
        },
        /** bind / unbind */
        action: {
            type: DataTypes.STRING(20),
            allowNull: false,
            field: 'action',
        },
        /** totp / hashkey */
        method: {
            type: DataTypes.STRING(20),
            allowNull: true,
            field: 'method',
        },
        /** success / failed */
        result: {
            type: DataTypes.STRING(20),
            allowNull: false,
            field: 'result',
        },
        reason: {
            type: DataTypes.STRING(200),
            allowNull: true,
            field: 'reason',
        },
        ipAddress: {
            type: DataTypes.STRING(64),
            allowNull: true,
            field: 'ip_address',
        },
        userAgent: {
            type: DataTypes.TEXT,
            allowNull: true,
            field: 'user_agent',
        },
        created_at: {
            type: DataTypes.DATE,
            allowNull: false,
            defaultValue: DataTypes.NOW,
            field: 'created_at',
        },
    },
    {
        tableName: 'merchant_bind_audit',
        timestamps: false,
    }
);

module.exports = MerchantBindAudit;
