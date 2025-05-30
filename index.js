require('dotenv').config();
const sequelize = require('./server/config/database');
const path = require('path');
const express = require('express');
const app = express();
const port = process.env.PORT;
const apiRoute = require('./server/routes/vtuber-chat-api/index');
const cors = require('cors');

app.use(express.static(path.join(__dirname, 'public')));
app.use((req, res, next) => {
    console.log(`${req.method} ${req.originalUrl}`);
    next();
});
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/api/v1', apiRoute);
app.use((req, res, next) => {
    if (process.env.NODE_ENV === 'development') {
        console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
    }
    next();
});
app.get('/', (req, res) => {
    res.redirect('/login.html');
});

sequelize
    .authenticate()
    .then(() => {
        console.log('資料庫連線成功！');
        app.listen(port, () => {
            console.log(`Server is running on http://localhost:${port}`);
        });
    })
    .catch(error => {
        console.error('資料庫連線失敗：', error);
        process.exit(1); // 連線失敗就結束程式
    });
