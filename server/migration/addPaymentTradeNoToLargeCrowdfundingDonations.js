/**
 * large_crowdfunding_donations 新增 payment_trade_no（金流單號冪等）
 *
 * 執行：node server/migration/addPaymentTradeNoToLargeCrowdfundingDonations.js
 */
const sequelize = require('../config/database');

const TABLE = 'large_crowdfunding_donations';

(async () => {
    try {
        const [cols] = await sequelize.query(
            `
            SELECT column_name
            FROM information_schema.columns
            WHERE table_schema = 'public'
              AND table_name = :tableName
              AND column_name = 'payment_trade_no'
            `,
            { replacements: { tableName: TABLE } }
        );

        if (cols.length > 0) {
            console.log('payment_trade_no 欄位已存在，跳過');
            process.exit(0);
        }

        await sequelize.query(`
            ALTER TABLE ${TABLE}
            ADD COLUMN payment_trade_no VARCHAR(50) NULL
        `);

        await sequelize.query(`
            CREATE UNIQUE INDEX uq_lcf_donations_payment_trade_no
            ON ${TABLE} (payment_trade_no)
            WHERE payment_trade_no IS NOT NULL
        `);

        console.log(`${TABLE}.payment_trade_no 新增完成`);
        process.exit(0);
    } catch (error) {
        console.error('新增 payment_trade_no 失敗:', error);
        process.exit(1);
    }
})();
