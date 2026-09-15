const { getEcpayConfigByMerchantId } = require('../../store/ecpay-config');
const { getActiveMemberByMerchantId } = require('../../store/merchant-member');

/**
 * 查詢商店狀態，登入頁靠它決定要走哪一條流程。
 *
 * googleBound 用來區分「這間店已經遷移到 Google 登入」：
 * 遷移後 totpEnabled 會被關掉，若前端只看 totpEnabled 會誤判成
 * 「尚未綁定 TOTP」而把使用者導去 totp-setup，形成回頭路。
 */
module.exports = async (req, res) => {
    try {
        const { merchantId } = req.params;

        const config = await getEcpayConfigByMerchantId(merchantId);
        if (!config) {
            res.json({ exists: false });
            return;
        }

        const member = await getActiveMemberByMerchantId(config.merchantId);

        res.json({
            exists: true,
            totpEnabled: Boolean(config.totpEnabled),
            googleBound: Boolean(member),
        });
    } catch (error) {
        console.error('檢查商店時發生錯誤:', error);
        res.status(500).json({ error: '伺服器錯誤' });
    }
};
