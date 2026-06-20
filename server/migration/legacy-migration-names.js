/**
 * 導入 Umzug 之前、已手動跑過的舊 migration 檔名（不含 .js）
 * 用於 bootstrap-legacy-records.js 寫入 schema_migrations，避免誤判為未執行。
 *
 * 新增 Umzug migration 後請勿把新檔名加在這裡。
 */
module.exports = [
    'addBlockedKeywordsToEcpayConfig',
    'addCostColumn',
    'addDisplayNameToEcpayConfig',
    'addDonationTypeColumn',
    'addEcpayAndPAYUNiEnableColumnsToEcpayConfig',
    'addEcpayConfigIdToDonations',
    'addEcpayConfigIdToFundraisingEvents',
    'addEcpayConfigIdToLargeCrowdfunding',
    'addLargeCrowdfundingEnabledToEcpayConfig',
    'addLeaderboardTitlesToLargeCrowdfundingPages',
    'addLcfPaymentEnableColumnsToEcpayConfig',
    'addMerchantIdUniqueIndex',
    'addOpayColumnsToEcpayConfig',
    'addPAYUniColumnsToEcpayConfig',
    'addPaymentTradeNoToLargeCrowdfundingDonations',
    'addStatusToLargeCrowdfundingPages',
    'addThemeColorsToEcpayConfig',
    'addTotpColumnsToEcpayConfig',
    'addTypeColumn',
    'addUpdatedAtToFundraisingEvents',
    'addUpdatedAtToIchibanEvents',
    'addYoutubeColumnsToEcpayConfig',
    'addYoutubeDonationAmountColumnsToEcpayConfig',
    'adjustLargeCrowdfundingPageVisualFields',
    'allowNullEcpayConfigForPayuni',
    'createLargeCrowdfundingTables',
    'createPaymentPendingOrdersTable',
    'expandDonationMessageToText',
    'specialThemeTierIconUrlColumn',
];
