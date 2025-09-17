const { decryptDataAndUrlDecode } = require('../../service/decrypt');
const { addDonation } = require('../../service/vtuber-chat-api');
const { getEcpayConfigByMerchantId } = require('../../store/ecpayConfig');
const { createDonation } = require('../../service/donation');

async function getConfigByMerchantId(merchantId) {
    try {
        const configData = await getEcpayConfigByMerchantId(merchantId);
        return configData;
    } catch (error) {
        throw new Error(`無法讀取商店 ${merchantId} 的設定：${error.message}`);
    }
}

module.exports = async (req, res) => {
    try {
        const { merchantId } = req.params;
        const { hashIV, hashKey } = await getConfigByMerchantId(merchantId);
        const { Data, TransCode, TransMsg } = req.body;

        console.log(Data);

        const {
            MerchantID,
            RtnCode,
            RtnMsg,
            OrderInfo,
            PatronName,
            PatronNote,
        } = decryptDataAndUrlDecode(Data, hashKey, hashIV);

        if (RtnCode === 1) {
            await createDonation({
                merchantId: MerchantID,
                name: PatronName,
                cost: OrderInfo.TradeAmt,
                message: PatronNote,
            });
        }

        res.send('1|OK');
    } catch (error) {
        console.error(error);
        res.status(500).json({ error: error.message });
    }
};
