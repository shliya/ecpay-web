const fs = require('fs').promises;
const path = require('path');
const baseDir = path.join(__dirname, '../db');

async function ensureDirectory() {
    try {
        await fs.access(baseDir);
    } catch (error) {
        await fs.mkdir(baseDir, { recursive: true });
    }
}

async function addDonation(vtuberName, { name, cost, message }) {
    try {
        await ensureDirectory();

        const filePath = path.join(baseDir, `${vtuberName}.json`);
        let donations = [];

        try {
            const fileContent = await fs.readFile(filePath, 'utf-8');
            donations = JSON.parse(fileContent);
        } catch (error) {
            donations = [];
        }

        donations.push({
            name,
            cost,
            message,
            timestamp: new Date().toISOString(),
        });

        await fs.writeFile(
            filePath,
            JSON.stringify(donations, null, 2),
            'utf-8'
        );

        return 'success';
    } catch (error) {
        console.error('儲存打賞記錄時發生錯誤:', error);
    }
}

module.exports = {
    addDonation,
    // getDonationsByUid,
};
