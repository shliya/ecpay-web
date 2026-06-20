/**
 * @deprecated 請改用：npm run migrate 或 node server/migration/migrate.js up
 *
 * 保留此檔僅供舊文件相容；邏輯已移至
 * server/migration/umzug/001-addStatusToPaymentPendingOrders.js
 */
require('dotenv').config();

const { createUmzug, sequelize } = require('./create-umzug');

(async () => {
    console.warn(
        '[deprecated] addStatusToPaymentPendingOrders.js → 請改用 npm run migrate'
    );
    const umzug = createUmzug();
    try {
        await umzug.up({
            migrations: ['001-addStatusToPaymentPendingOrders.js'],
        });
    } catch (error) {
        console.error('addStatusToPaymentPendingOrders 失敗:', error);
        process.exitCode = 1;
    } finally {
        await sequelize.close();
    }
})();
