const { getEcPayDonations } = require('../../lib/ecpayAPI');
const { decryptDataAndUrlDecode } = require('../../service/decrypt');
const { addDonation } = require('../../service/vtuber-chat-api');
const fs = require('fs/promises');
const path = require('path');

async function getConfigByMerchantId(merchantId) {
    try {
        const configPath = path.join(
            process.cwd(),
            'server/config',
            `${merchantId}.json`
        );
        const configData = await fs.readFile(configPath, 'utf-8');
        return JSON.parse(configData);
    } catch (error) {
        throw new Error(`無法讀取商店 ${merchantId} 的設定：${error.message}`);
    }
}

module.exports = async (req, res) => {
    try {
        const { Data, TransCode, TransMsg } = req.body;
        const { merchantId } = req.params;
        console.log(merchantId);
        const { hashIV, hashKey } = await getConfigByMerchantId(merchantId);
        console.log(hashIV, hashKey);
        const {
            MerchantID,
            RtnCode,
            RtnMsg,
            OrderInfo,
            PatronName,
            PatronNote,
        } = decryptDataAndUrlDecode(Data, hashKey, hashIV);

        if (RtnCode === 1) {
            await addDonation(MerchantID, {
                name: PatronName,
                cost: OrderInfo.TradeAmt,
                message: PatronNote,
            });
        }

        res.send('1|OK');
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};
