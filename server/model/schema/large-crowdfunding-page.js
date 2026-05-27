const { DataTypes } = require('sequelize');
const sequelize = require('../../config/database');

const LargeCrowdfundingPage = sequelize.define(
    'LargeCrowdfundingPage',
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
        pageKey: {
            type: DataTypes.STRING(80),
            allowNull: false,
            field: 'pageKey',
        },
        largeFundraisingName: {
            type: DataTypes.STRING(200),
            allowNull: false,
            defaultValue: '',
            field: 'largeFundraisingName',
        },
        title: {
            type: DataTypes.STRING(200),
            allowNull: false,
            defaultValue: '',
        },
        sponsorLabel: {
            type: DataTypes.TEXT,
            allowNull: false,
            defaultValue: '',
            field: 'sponsorLabel',
        },
        fundraisingStartsAt: {
            type: DataTypes.DATE,
            allowNull: true,
            field: 'fundraisingStartsAt',
        },
        fundraisingEndsAt: {
            type: DataTypes.DATE,
            allowNull: true,
            field: 'fundraisingEndsAt',
        },
        manuallyClosed: {
            type: DataTypes.BOOLEAN,
            allowNull: false,
            defaultValue: false,
            field: 'manuallyClosed',
        },
        backgroundImageUrl: {
            type: DataTypes.TEXT,
            allowNull: false,
            defaultValue: '',
            field: 'backgroundImageUrl',
        },
        heroImageUrl: {
            type: DataTypes.TEXT,
            allowNull: false,
            defaultValue: '',
            field: 'heroImageUrl',
        },
        donorListBackgroundImageUrl: {
            type: DataTypes.TEXT,
            allowNull: false,
            defaultValue: '',
            field: 'donorListBackgroundImageUrl',
        },
        /** 榜十大哥標題：文字或圖片網址 */
        mainDonorListTitle: {
            type: DataTypes.TEXT,
            allowNull: false,
            defaultValue: '',
            field: 'mainDonorListTitle',
        },
        /** 特殊主題榜標題：文字或圖片網址 */
        specialThemeRankingTitle: {
            type: DataTypes.TEXT,
            allowNull: false,
            defaultValue: '',
            field: 'specialThemeRankingTitle',
        },
        donorTierIcons: {
            type: DataTypes.JSONB,
            allowNull: false,
            defaultValue: {},
            field: 'donorTierIcons',
        },
        /** 特殊主題榜：全名次共用一張圖示 */
        specialThemeTierIconUrl: {
            type: DataTypes.TEXT,
            allowNull: false,
            defaultValue: '',
            field: 'specialThemeTierIconUrl',
        },
        theme: {
            type: DataTypes.JSONB,
            allowNull: false,
            defaultValue: {},
        },
        contentBlocks: {
            type: DataTypes.JSONB,
            allowNull: false,
            defaultValue: [],
            field: 'contentBlocks',
        },
        milestones: {
            type: DataTypes.JSONB,
            allowNull: false,
            defaultValue: [],
        },
        currentTotal: {
            type: DataTypes.INTEGER,
            allowNull: false,
            defaultValue: 0,
            field: 'currentTotal',
        },
        publishedAt: {
            type: DataTypes.DATE,
            allowNull: true,
            field: 'publishedAt',
        },
        /** 1=啟動 2=結束 3=刪除（列表不顯示） */
        status: {
            type: DataTypes.SMALLINT,
            allowNull: false,
            defaultValue: 1,
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
        tableName: 'large_crowdfunding_pages',
        timestamps: false,
        indexes: [
            {
                name: 'uq_large_crowdfunding_pages_merchant_page',
                unique: true,
                fields: ['merchantId', 'pageKey'],
            },
            {
                name: 'idx_large_crowdfunding_pages_page_key',
                fields: ['pageKey'],
            },
        ],
    }
);

module.exports = LargeCrowdfundingPage;
