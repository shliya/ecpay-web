require('dotenv').config();

const { Sequelize } = require('sequelize');

const sequelize = new Sequelize(
    process.env.DB_NAME,
    process.env.DB_USER,
    process.env.DB_PASSWORD,
    {
        host: process.env.DB_HOST,
        port: 6543,
        dialect: 'postgres',
        logging: true,
        dialectOptions: {
            ssl: {
                require: true,
                rejectUnauthorized: false,
            },
            // Transaction Pooler 特定設定
            application_name: 'transaction_pooler',
            statement_timeout: 60000,
            idle_in_transaction_session_timeout: 60000,
        },
        pool: {
            max: 10,
            min: 0,
            acquire: 30000,
            idle: 10000,
        },
    }
);

sequelize
    .authenticate()
    .then(() => {
        console.log('資料庫連接成功');
    })
    .catch(err => {
        console.error('資料庫連接失敗:', err);
    });

module.exports = sequelize;
