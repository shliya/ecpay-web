const fs = require('fs/promises');
const path = require('path');

module.exports = async (req, res) => {
    try {
        const { merchantId } = req.params;
        const configPath = path.join(
            process.cwd(),
            'server/config',
            `${merchantId}.json`
        );

        try {
            await fs.access(configPath);
            res.json({ exists: true });
        } catch {
            res.json({ exists: false });
        }
    } catch (error) {
        console.error('檢查商店時發生錯誤:', error);
        res.status(500).json({ error: '伺服器錯誤' });
    }
};
