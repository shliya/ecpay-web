const FundraisingEventsModel = require('../../model/fundraising-events');
const DonationModel = require('../../model/donation');
const EcpayConfigModel = require('../../model/ecpayConfig');
const IchibanEventModel = require('../../model/ichiban-event');
const IchibanCardModel = require('../../model/ichiban-card');
const IchibanPrizeModel = require('../../model/ichiban-prize');

(async () => {
    try {
        await FundraisingEventsModel.sequelize.sync();
        await DonationModel.sequelize.sync();
        await EcpayConfigModel.sequelize.sync();
        await IchibanEventModel.sequelize.sync();
        await IchibanCardModel.sequelize.sync();
        await IchibanPrizeModel.sequelize.sync();
    } catch (error) {
        console.error('同步資料庫時發生錯誤:', error);
    }
})();
