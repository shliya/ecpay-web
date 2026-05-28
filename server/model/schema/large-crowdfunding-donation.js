const { DataTypes } = require('sequelize');
const sequelize = require('../../config/database');

const LargeCrowdfundingDonation = sequelize.define(
    'LargeCrowdfundingDonation',
    {
        id: {
            type: DataTypes.BIGINT,
            primaryKey: true,
            autoIncrement: true,
            allowNull: false,
        },
        largeCrowdfundingPageId: {
            type: DataTypes.BIGINT,
            allowNull: false,
            field: 'largeCrowdfundingPageId',
            references: {
                model: 'large_crowdfunding_pages',
                key: 'id',
            },
        },
        ecpayConfigId: {
            type: DataTypes.BIGINT,
            allowNull: false,
            field: 'ecpayConfigId',
            references: { model: 'ecpay_config', key: 'id' },
        },
        merchantId: {
            type: DataTypes.STRING(50),
            allowNull: false,
            field: 'merchantId',
        },
        pageKey: {
            type: DataTypes.STRING(80),
            allowNull: false,
            field: 'pageKey',
        },
        donorName: {
            type: DataTypes.STRING(100),
            allowNull: false,
            field: 'donorName',
        },
        amount: {
            type: DataTypes.INTEGER,
            allowNull: false,
        },
        message: {
            type: DataTypes.TEXT,
            allowNull: true,
        },
        sourceDonationId: {
            type: DataTypes.BIGINT,
            allowNull: true,
            field: 'sourceDonationId',
            references: { model: 'donations', key: 'id' },
        },
        paymentTradeNo: {
            type: DataTypes.STRING(50),
            allowNull: true,
            field: 'payment_trade_no',
        },
        created_at: {
            type: DataTypes.DATE,
            allowNull: false,
            defaultValue: DataTypes.NOW,
            field: 'created_at',
        },
    },
    {
        tableName: 'large_crowdfunding_donations',
        timestamps: false,
        indexes: [
            {
                name: 'idx_lcf_donations_page_created',
                fields: ['largeCrowdfundingPageId', 'created_at'],
            },
            {
                name: 'idx_lcf_donations_page_amount',
                fields: ['largeCrowdfundingPageId', 'amount'],
            },
            {
                name: 'idx_lcf_donations_page_key_created',
                fields: ['pageKey', 'created_at'],
            },
            {
                name: 'uq_lcf_donations_payment_trade_no',
                unique: true,
                fields: ['paymentTradeNo'],
            },
        ],
    }
);

module.exports = LargeCrowdfundingDonation;
