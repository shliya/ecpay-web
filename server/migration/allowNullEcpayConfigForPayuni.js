const sequelize = require('../config/database');

(async () => {
    try {
        console.log(
            '將 ecpay_config 的 merchantId / hashKey / hashIV 改為可 NULL（支援僅 PayUni 商店）...'
        );

        await sequelize.query(`
            ALTER TABLE ecpay_config 
            ALTER COLUMN "merchantId" DROP NOT NULL
        `);
        console.log('merchantId 已改為可 NULL');

        await sequelize.query(`
            ALTER TABLE ecpay_config 
            ALTER COLUMN "hashKey" DROP NOT NULL
        `);
        console.log('hashKey 已改為可 NULL');

        await sequelize.query(`
            ALTER TABLE ecpay_config 
            ALTER COLUMN "hashIV" DROP NOT NULL
        `);
        console.log('hashIV 已改為可 NULL');

        console.log('完成');
        process.exit(0);
    } catch (error) {
        console.error('migration 錯誤:', error);
        process.exit(1);
    }
})();
