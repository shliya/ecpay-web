/**
 * payment_pending_orders 新增 status（pending / completed / expired / failed）
 */
const TABLE = 'payment_pending_orders';

async function columnExists(sequelize, columnName) {
    const [rows] = await sequelize.query(
        `
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = :tableName
          AND column_name = :columnName
        LIMIT 1
        `,
        { replacements: { tableName: TABLE, columnName } }
    );
    return rows.length > 0;
}

async function indexExists(sequelize, indexName) {
    const [rows] = await sequelize.query(
        `
        SELECT 1
        FROM pg_indexes
        WHERE schemaname = 'public'
          AND tablename = :tableName
          AND indexname = :indexName
        LIMIT 1
        `,
        { replacements: { tableName: TABLE, indexName } }
    );
    return rows.length > 0;
}

/** @param {{ context: import('sequelize').Sequelize }} params */
async function up({ context: sequelize }) {
    if (!(await columnExists(sequelize, 'status'))) {
        await sequelize.query(`
            ALTER TABLE ${TABLE}
            ADD COLUMN status VARCHAR(20) NOT NULL DEFAULT 'pending'
        `);
        await sequelize.query(`
            UPDATE ${TABLE}
            SET status = 'pending'
            WHERE status IS NULL OR status = ''
        `);
    }

    if (!(await indexExists(sequelize, 'idx_payment_pending_orders_status'))) {
        await sequelize.query(`
            CREATE INDEX idx_payment_pending_orders_status
            ON ${TABLE} (status)
        `);
    }
}

/** @param {{ context: import('sequelize').Sequelize }} params */
async function down({ context: sequelize }) {
    if (await indexExists(sequelize, 'idx_payment_pending_orders_status')) {
        await sequelize.query(`
            DROP INDEX IF EXISTS idx_payment_pending_orders_status
        `);
    }
    if (await columnExists(sequelize, 'status')) {
        await sequelize.query(`
            ALTER TABLE ${TABLE}
            DROP COLUMN status
        `);
    }
}

module.exports = { up, down };
