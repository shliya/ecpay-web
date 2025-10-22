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

module.exports = {
    createEcpayConfig,
};
