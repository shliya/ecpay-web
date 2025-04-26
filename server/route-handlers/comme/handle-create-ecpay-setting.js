const fs = require('fs/promises');
const path = require('path');

module.exports = async (req, res) => {
    try {
        const { merchantId, hashKey, hashIV } = req.body;

        if (!merchantId || !hashKey || !hashIV) {
            return res.status(400).json({ message: '所有欄位都是必填的' });
        }
        const configDir = path.join(process.cwd(), 'server/config');
        await fs.mkdir(configDir, { recursive: true });

        const configPath = path.join(configDir, `${merchantId}.json`);
        await fs.writeFile(
            configPath,
            JSON.stringify(
                {
                    merchantId,
                    hashKey,
                    hashIV,
                },
                null,
                2
            )
        );

        res.status(200).json({ message: '設定已儲存' });
    } catch (error) {
        console.error('儲存設定時發生錯誤:', error);
        res.status(500).json({ message: '伺服器錯誤' });
    }
};
