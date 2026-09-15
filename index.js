require('dotenv').config();
require('./server/lib/totp-session-secret').getTotpSessionSecret();
const sequelize = require('./server/config/database');
const path = require('path');
const express = require('express');
const http = require('http');
const app = express();
const port = process.env.PORT || 3001;
const cors = require('cors');
const { scheduler } = require('./server/lib/scheduler');
const IchibanWebSocketServer = require('./server/web-socket/server');
const { toNodeHandler } = require('better-auth/node');
const { auth, authPool } = require('./server/lib/auth');

const server = http.createServer(app);

const ichibanWebSocketServer = new IchibanWebSocketServer(server);

// 設置全域 WebSocket 服務器實例
global.ichibanWebSocketServer = ichibanWebSocketServer;

const apiRoute = require('./server/routes/hamster-tools/index');

app.set('trust proxy', 1);
app.use(express.static(path.join(__dirname, 'public')));
app.use((req, res, next) => {
    console.log(`${req.method} ${req.originalUrl}`);
    next();
});
// 只有明確設定 ALLOWED_ORIGINS 時才允許「帶 cookie」的跨來源請求。
// 未設定時維持原本的寬鬆來源，但不開 credentials —— 否則任何網站都能
// 帶著使用者的 session cookie 打這支 API（CSRF）。
const allowedOrigins = String(process.env.ALLOWED_ORIGINS || '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);
const hasOriginAllowList = allowedOrigins.length > 0;
app.use(
    cors({
        origin: hasOriginAllowList ? allowedOrigins : true,
        credentials: hasOriginAllowList,
    })
);

// better-auth 的路由必須掛在 express.json() 之前：
// toNodeHandler 要自己讀原始 request body，先被 express.json() 解析掉會失敗。
app.all('/api/auth/*', toNodeHandler(auth));

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
app.get('/robots.txt', (req, res) => {
    res.type('text/plain');
    res.sendFile(path.join(__dirname, 'static', 'robots.txt'));
});

sequelize
    .authenticate()
    .then(() => {
        console.log('資料庫連線成功！');

        // 啟動定時任務排程器
        scheduler.start();

        ichibanWebSocketServer.start();

        server.listen(port, () => {
            console.log(`Server is running on http://localhost:${port}`);
        });
    })
    .catch(error => {
        console.error('資料庫連線失敗：', error);
        process.exit(1); // 連線失敗就結束程式
    });

// 優雅關閉處理
process.on('SIGINT', () => {
    console.log('\n接收到 SIGINT，正在優雅關閉...');
    scheduler.stop();
    Promise.all([sequelize.close(), authPool.end()]).then(() => {
        console.log('資料庫連線已關閉');
        process.exit(0);
    });
});

process.on('SIGTERM', () => {
    console.log('\n接收到 SIGTERM，正在優雅關閉...');
    scheduler.stop();
    ichibanWebSocketServer.stop();
    Promise.all([sequelize.close(), authPool.end()]).then(() => {
        console.log('資料庫連線已關閉');
        process.exit(0);
    });
});
