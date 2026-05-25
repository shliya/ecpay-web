const LargeCrowdfundingPage = require('./schema/large-crowdfunding-page');
const LargeCrowdfundingDonation = require('./schema/large-crowdfunding-donation');

LargeCrowdfundingPage.hasMany(LargeCrowdfundingDonation, {
    foreignKey: 'largeCrowdfundingPageId',
    as: 'donations',
});

LargeCrowdfundingDonation.belongsTo(LargeCrowdfundingPage, {
    foreignKey: 'largeCrowdfundingPageId',
    as: 'page',
});

module.exports = LargeCrowdfundingPage;
