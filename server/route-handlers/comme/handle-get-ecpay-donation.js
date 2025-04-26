const fs = require('fs/promises');
const path = require('path');

module.exports = async (req, res) => {
    try {
        const { merchantId } = req.params;
        const configPath = path.join(
            process.cwd(),
            'server/db',
            `${merchantId}.json`
        );

        try {
            const fileContent = await fs.readFile(configPath, 'utf-8');
            const donationData = JSON.parse(fileContent);

            res.json(donationData);
        } catch (error) {
            if (error.code === 'ENOENT') {
                res.json([]);
            } else {
                throw error;
            }
        }
    } catch (error) {
        console.error('檢查商店時發生錯誤:', error);
        res.status(500).json({ error: '伺服器錯誤' });
    }
};
