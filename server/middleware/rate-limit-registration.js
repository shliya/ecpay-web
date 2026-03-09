const rateLimit = require('express-rate-limit');

const REGISTRATION_WINDOW_MS = 60 * 60 * 1000;
const REGISTRATION_MAX_REQUESTS = 3;

const registrationRateLimiter = rateLimit({
    windowMs: REGISTRATION_WINDOW_MS,
    max: REGISTRATION_MAX_REQUESTS,
    message: { error: '註冊請求過於頻繁，請稍後再試' },
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res, next, options) => {
        const ip = req.ip || req.connection?.remoteAddress || 'unknown';
        console.log(
            `[RateLimit] 註冊 API 觸發限制 - IP: ${ip}, path: ${req.originalUrl}`
        );
        res.status(options.statusCode || 429).json(options.message);
    },
});

module.exports = registrationRateLimiter;
