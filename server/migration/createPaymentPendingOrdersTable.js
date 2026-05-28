/**
 * 付款建單暫存（取代程序內 Map，重啟後仍可對應回調）
 *
 * 執行：node server/migration/createPaymentPendingOrdersTable.js
 */
const sequelize = require('../config/database');

const TABLE = 'payment_pending_orders';

async function tableExists(tableName) {
    const [rows] = await sequelize.query(
        `
        SELECT 1
        FROM information_schema.tables
        WHERE table_schema = 'public'
          AND table_name = :tableName
        LIMIT 1
        `,
        { replacements: { tableName } }
    );
    return rows.length > 0;
}

(async () => {
    try {
        if (await tableExists(TABLE)) {
            console.log(`${TABLE} 已存在，跳過建表`);
            process.exit(0);
        }

        console.log(`建立 ${TABLE}...`);
        await sequelize.query(`
            CREATE TABLE ${TABLE} (
                merchant_trade_no VARCHAR(50) PRIMARY KEY,
                kind VARCHAR(30) NOT NULL DEFAULT '',
                meta JSONB NOT NULL DEFAULT '{}'::jsonb,
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
                expires_at TIMESTAMPTZ NOT NULL
            )
        `);
        await sequelize.query(`
            CREATE INDEX idx_payment_pending_orders_expires
            ON ${TABLE} (expires_at)
        `);

        console.log(`${TABLE} 建立完成`);
        process.exit(0);
    } catch (error) {
        console.error('createPaymentPendingOrdersTable 失敗:', error);
        process.exit(1);
    }
})();
