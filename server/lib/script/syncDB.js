const FundraisingEventsModel = require('../../model/fundraising-events');
const DonationModel = require('../../model/donation');
const EcpayConfigModel = require('../../model/ecpayConfig');
const IchibanEventModel = require('../../model/ichiban-event');
const IchibanCardModel = require('../../model/ichiban-card');
const IchibanPrizeModel = require('../../model/ichiban-prize');
const LargeCrowdfundingPageModel = require('../../model/large-crowdfunding-page');
const LargeCrowdfundingDonationModel = require('../../model/large-crowdfunding-donation');
const PaymentPendingOrderModel = require('../../model/payment-pending-order');

(async () => {
    try {
        await FundraisingEventsModel.sequelize.sync();
        await DonationModel.sequelize.sync();
        await EcpayConfigModel.sequelize.sync();
        await IchibanEventModel.sequelize.sync();
        await IchibanCardModel.sequelize.sync();
        await IchibanPrizeModel.sequelize.sync();
        await LargeCrowdfundingPageModel.sequelize.sync();
        await LargeCrowdfundingDonationModel.sequelize.sync();
        await PaymentPendingOrderModel.sequelize.sync();
    } catch (error) {
        console.error('同步資料庫時發生錯誤:', error);
    }
})();
