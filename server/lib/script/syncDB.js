const FundraisingEventsModel = require('../../model/fundraising-events');
const DonationModel = require('../../model/donation');
const EcpayConfigModel = require('../../model/ecpayConfig');

(async () => {
    try {
        await FundraisingEventsModel.sequelize.sync();
        await DonationModel.sequelize.sync();
        await EcpayConfigModel.sequelize.sync();
    } catch (error) {
        console.error('同步資料庫時發生錯誤:', error);
    }
})();
