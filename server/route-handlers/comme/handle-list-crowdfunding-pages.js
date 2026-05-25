const {
    listPageSummariesByMerchantId,
} = require('../../service/large-crowdfunding-page');
const { getSafeApiErrorMessage } = require('../../lib/safe-error-message');
const {
    rejectIfLargeCrowdfundingDisabled,
} = require('../../lib/large-crowdfunding-feature');

module.exports = async (req, res) => {
    try {
        const { merchantId } = req.params;
        if (!merchantId?.trim()) {
            res.status(400).json({ error: 'merchantId 為必填' });
            return;
        }
        const mid = merchantId.trim();
        if (!(await rejectIfLargeCrowdfundingDisabled(res, mid))) {
            return;
        }

        const pages = await listPageSummariesByMerchantId(mid);
        res.status(200).json({ pages });
    } catch (error) {
        console.error('[crowdfunding LIST]', error);
        res.status(500).json({
            error: getSafeApiErrorMessage(error, '取得大型募資列表失敗'),
        });
    }
};
