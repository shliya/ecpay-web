const fs = require('fs').promises;
const path = require('path');
const baseDir = path.join(__dirname, '../db');

const SAFE_NAME_PATTERN = /^[a-zA-Z0-9_-]+$/;

async function ensureDirectory() {
    try {
        await fs.access(baseDir);
    } catch (error) {
        await fs.mkdir(baseDir, { recursive: true });
    }
}

function getSafeFilePath(vtuberName) {
    const sanitized = path.basename(vtuberName);
    if (!SAFE_NAME_PATTERN.test(sanitized)) {
        throw new Error('無效的 vtuber 名稱');
    }
    const filePath = path.resolve(baseDir, `${sanitized}.json`);
    if (!filePath.startsWith(path.resolve(baseDir))) {
        throw new Error('無效的檔案路徑');
    }
    return filePath;
}

async function addDonation(vtuberName, { name, cost, message }) {
    await ensureDirectory();

    const filePath = getSafeFilePath(vtuberName);
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

    await fs.writeFile(filePath, JSON.stringify(donations, null, 2), 'utf-8');

    return 'success';
}

module.exports = {
    addDonation,
    // getDonationsByUid,
};
