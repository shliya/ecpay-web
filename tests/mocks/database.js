/**
 * config/database 的測試替身：提供 Sequelize instance 介面，
 * 讓 model/schema 檔案可以載入而不建立真實連線。
 */
function createModelStub() {
    return {
        hasMany: () => {},
        belongsTo: () => {},
        findAll: async () => [],
        findOne: async () => null,
        create: async row => row,
        update: async () => [0],
        destroy: async () => 0,
        sum: async () => 0,
        upsert: async () => {},
    };
}

module.exports = {
    define: () => createModelStub(),
    transaction: async () => ({
        commit: async () => {},
        rollback: async () => {},
    }),
    query: async () => [[], []],
    authenticate: async () => {},
    close: async () => {},
};
