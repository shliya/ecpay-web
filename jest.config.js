module.exports = {
    testEnvironment: 'node',
    roots: ['<rootDir>/tests'],
    // 單元測試不連真 DB：把 Sequelize instance 換成 stub
    moduleNameMapper: {
        '^.+config/database$': '<rootDir>/tests/mocks/database.js',
    },
    clearMocks: true,
    verbose: true,
};
