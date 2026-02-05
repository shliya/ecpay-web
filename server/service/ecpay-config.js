const ecpayConfigStore = require('../store/ecpay-config');
const { ECPAY_CONFIG_DUPLICATE_CODE } = require('../lib/error/code');

async function createEcpayConfig(row) {
    const txn = await ecpayConfigStore.getTransaction();
    try {
        const result = await ecpayConfigStore.createEcpayConfig(row, {
            transaction: txn,
        });
        await txn.commit();
        return result;
    } catch (error) {
        console.error('儲存設定時發生錯誤:', error);
        if (error.name === 'SequelizeUniqueConstraintError') {
            throw new Error(ECPAY_CONFIG_DUPLICATE_CODE.message);
        }
        await txn.rollback();
        throw error;
    }
}

async function updateEcpayConfig(merchantId, updates) {
    const allowedFields = [
        'displayName',
        'hashKey',
        'hashIV',
        'youtubeChannelHandle',
        'youtubeChannelId',
        'themeColors',
    ];
    const updateData = {};

    for (const field of allowedFields) {
        if (updates.hasOwnProperty(field)) {
            if (field === 'themeColors') {
                updateData[field] =
                    updates[field] != null && typeof updates[field] === 'object'
                        ? updates[field]
                        : null;
            } else if (field === 'displayName') {
                updateData[field] =
                    updates[field] != null && String(updates[field]).trim()
                        ? String(updates[field]).trim()
                        : null;
            } else {
                updateData[field] =
                    updates[field] != null && String(updates[field]).trim()
                        ? String(updates[field]).trim()
                        : null;
            }
        }
    }

    if (Object.keys(updateData).length === 0) {
        const config =
            await ecpayConfigStore.getEcpayConfigByMerchantId(merchantId);
        return config;
    }

    try {
        const result = await ecpayConfigStore.updateEcpayConfig(
            merchantId,
            updateData
        );
        return result;
    } catch (error) {
        if (error.name === 'SequelizeUniqueConstraintError') {
            throw new Error('displayName 已被使用，請選擇其他名稱');
        }
        throw error;
    }
}

module.exports = {
    createEcpayConfig,
    updateEcpayConfig,
};
