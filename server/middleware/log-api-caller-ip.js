/**
 * 記錄 API 呼叫者的 IP
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
function getClientIp(req) {
    const forwarded = req.headers['x-forwarded-for'];
    if (forwarded && typeof forwarded === 'string') {
        return forwarded.split(',')[0].trim();
    }
    const realIp = req.headers['x-real-ip'];
    if (realIp) {
        return realIp;
    }
    const socket = req.connection || req.socket;
    if (socket && socket.remoteAddress) {
        return socket.remoteAddress;
    }
    if (req.ip) {
        return req.ip;
    }
    return 'unknown';
}

function logApiCallerIp(req, res, next) {
    const ip = getClientIp(req);
    const method = req.method;
    const path = req.originalUrl || req.url;
    console.log(`[API] ${method} ${path} - caller IP: ${ip}`);
    next();
}

module.exports = logApiCallerIp;
