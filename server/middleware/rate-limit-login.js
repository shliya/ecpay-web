const rateLimit = require('express-rate-limit');

const LOGIN_WINDOW_MS = 60 * 60 * 1000;
const LOGIN_MAX_REQUESTS = 100;

const loginRateLimiter = rateLimit({
    windowMs: LOGIN_WINDOW_MS,
    max: LOGIN_MAX_REQUESTS,
    message: { error: '登入請求過於頻繁，請稍後再試' },
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res, next, options) => {
        const ip = req.ip || req.connection?.remoteAddress || 'unknown';
        console.log(
            `[RateLimit] 登入 API 觸發限制 - IP: ${ip}, path: ${req.originalUrl}`
        );
        res.status(options.statusCode || 429).json(options.message);
    },
});

module.exports = loginRateLimiter;
