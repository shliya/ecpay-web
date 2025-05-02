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
            field: 'id',
            defaultValue: sequelize.literal("nextval('donations_id_seq')"),
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
        timestamps: false,
        hooks: {
            beforeCreate: async donation => {
                if (!donation.id) {
                    const result = await sequelize.query(
                        "SELECT nextval('donations_id_seq') as next_id"
                    );
                    donation.id = result[0][0].next_id;
                }
            },
        },
    }
);

module.exports = Donation;
