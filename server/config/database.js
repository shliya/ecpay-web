require('dotenv').config();

const { Sequelize } = require('sequelize');
let dbUrl;
if (process.env.NODE_ENV === 'production') {
    dbUrl = process.env.DATABASE_URL;
} else {
    dbUrl = process.env.TEST_DB_URL;
}
let ssl =
    process.env.NODE_ENV === 'production'
        ? {
              require: true,
              rejectUnauthorized: false,
          }
        : false;

const sequelize = new Sequelize(dbUrl, {
    dialect: 'postgres',
    logging: process.env.NODE_ENV === 'development' ? console.log : false,
    dialectOptions: {
        ssl,
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
});

sequelize
    .authenticate()
    .then(() => {
        console.log('資料庫連接成功');
    })
    .catch(err => {
        console.error('資料庫連接失敗:', err);
    });

module.exports = sequelize;
