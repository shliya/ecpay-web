const path = require('path');
const { Umzug, SequelizeStorage } = require('umzug');
const sequelize = require('../config/database');

const MIGRATIONS_DIR = path.join(__dirname, 'umzug');
const MIGRATIONS_GLOB = path.join(MIGRATIONS_DIR, '[0-9]*.js').replace(/\\/g, '/');

/**
 * @returns {import('umzug').Umzug}
 */
function createUmzug() {
    return new Umzug({
        migrations: {
            glob: MIGRATIONS_GLOB,
            resolve: ({ name, path: migrationPath, context }) => {
                const migration = require(migrationPath);
                return {
                    name,
                    up: async () => {
                        if (typeof migration.up !== 'function') {
                            throw new Error(`${name} 缺少 up()`);
                        }
                        await migration.up({ context });
                    },
                    down:
                        typeof migration.down === 'function'
                            ? async () => migration.down({ context })
                            : undefined,
                };
            },
        },
        context: sequelize,
        storage: new SequelizeStorage({
            sequelize,
            modelName: 'SchemaMigration',
            tableName: 'schema_migrations',
        }),
        logger: console,
    });
}

module.exports = {
    createUmzug,
    sequelize,
};
