const GENERIC_MESSAGE = '伺服器錯誤，請稍後再試';

function getSafeApiErrorMessage(error, fallback) {
    if (process.env.NODE_ENV === 'production') {
        return fallback || GENERIC_MESSAGE;
    }
    return (error && error.message) || fallback || GENERIC_MESSAGE;
}

module.exports = { getSafeApiErrorMessage, GENERIC_MESSAGE };
