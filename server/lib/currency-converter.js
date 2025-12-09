const axios = require('axios');

const TARGET_CURRENCY = 'TWD';

const exchangeRateCache = new Map();
const CACHE_DURATION = 60 * 60 * 1000;

async function getExchangeRate(fromCurrency, toCurrency) {
    if (fromCurrency === toCurrency) {
        return 1;
    }

    const cacheKey = `${fromCurrency}_${toCurrency}`;
    const cached = exchangeRateCache.get(cacheKey);

    if (cached && Date.now() - cached.timestamp < CACHE_DURATION) {
        return cached.rate;
    }

    try {
        const url = `https://api.exchangerate-api.com/v4/latest/${fromCurrency}`;

        const response = await axios.get(url, {
            timeout: 5000,
        });

        const rates = response.data.rates || response.data.conversion_rates;
        const rate = rates[toCurrency];

        if (!rate) {
            throw new Error(`找不到 ${fromCurrency} 到 ${toCurrency} 的匯率`);
        }

        exchangeRateCache.set(cacheKey, {
            rate,
            timestamp: Date.now(),
        });

        console.log(
            `[Currency Converter] ${fromCurrency} -> ${toCurrency} = ${rate}`
        );

        return rate;
    } catch (error) {
        console.error(
            `[Currency Converter] Exchangerate API 錯誤:`,
            error.message
        );
        throw error;
    }
}

async function convertToTWD(amount, fromCurrency) {
    if (!amount || !fromCurrency) {
        return amount;
    }

    if (fromCurrency === TARGET_CURRENCY) {
        return amount;
    }

    try {
        const rate = await getExchangeRate(fromCurrency, TARGET_CURRENCY);
        const convertedAmount = amount * rate;
        return Math.round(convertedAmount * 100) / 100;
    } catch (error) {
        console.error(
            `[Currency Converter] 轉換失敗 (${amount} ${fromCurrency} -> TWD):`,
            error.message
        );
        return amount;
    }
}

module.exports = {
    convertToTWD,
    getExchangeRate,
};
