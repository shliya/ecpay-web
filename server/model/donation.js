const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Donation = sequelize.define(
    'Donation',
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
        created_at: {
            type: DataTypes.DATE,
            allowNull: true,
            defaultValue: DataTypes.NOW,
            field: 'created_at',
        },
    },
    {
        tableName: 'donations',
        timestamps: false, // 若資料表沒有 updated_at、created_at 欄位自動維護，請設為 false
    }
);

module.exports = Donation;
