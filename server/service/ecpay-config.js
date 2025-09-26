const ecpayConfigStore = require('../store/ecpay-config');
const { ECPAY_CONFIG_DUPLICATE_CODE } = require('../lib/error/code');

async function createEcpayConfig(row, { transaction } = {}) {
    const txn = await ecpayConfigStore.getTransaction();
    try {
        await ecpayConfigStore.createEcpayConfig(row, { transaction: txn });
        await txn.commit();
    } catch (error) {
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
