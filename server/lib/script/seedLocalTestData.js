const fs = require('fs');
const path = require('path');
const { Op } = require('sequelize');
const LargeCrowdfundingPage = require('../../model/schema/large-crowdfunding-page');
const LargeCrowdfundingDonation = require('../../model/schema/large-crowdfunding-donation');
const PageStore = require('../../store/large-crowdfunding-page');
const { apiJsonToPageRow, LCF_PAGE_STATUS } = require('../large-crowdfunding');

const TEST_DATA_DIR = path.join(__dirname, '../../db/test-data');
const LCF_FIXTURE = 'large-crowdfunding.json';

/**
 * @param {string} dir
 * @returns {string[]}
 */
function listJsonFixtures(dir) {
    if (!fs.existsSync(dir)) {
        return [];
    }
    return fs
        .readdirSync(dir)
        .filter(name => name.endsWith('.json'))
        .map(name => path.join(dir, name));
}

/**
 * @param {object} fixture
 */
async function seedLargeCrowdfundingFixture(fixture) {
    const merchantId = String(fixture.merchantId || '').trim();
    const pageKey = String(fixture.pageKey || 'default').trim().toLowerCase();
    if (!merchantId || !pageKey) {
        console.warn('[seed] 略過：缺少 merchantId 或 pageKey');
        return;
    }

    const pageBody = fixture.page && typeof fixture.page === 'object' ? fixture.page : {};
    const donations = Array.isArray(fixture.donations) ? fixture.donations : [];
    const row = apiJsonToPageRow(pageBody, merchantId, pageKey);

    let page = await PageStore.findByMerchantIdAndPageKey(merchantId, pageKey);
    const now = new Date();
    if (page) {
        await page.update({
            ...row,
            updated_at: now,
        });
    } else {
        page = await LargeCrowdfundingPage.create({
            ...row,
            status: LCF_PAGE_STATUS.ACTIVE,
            currentTotal: 0,
            publishedAt: now,
            created_at: now,
            updated_at: now,
        });
    }

    if (!page.publishedAt) {
        await page.update({ publishedAt: now, updated_at: now });
    }

    const pageId = page.id;

    const testTradePrefix = `TEST-LCF-${pageKey}-`;
    await LargeCrowdfundingDonation.destroy({
        where: {
            [Op.or]: [
                { pageKey, merchantId },
                { paymentTradeNo: { [Op.like]: `${testTradePrefix}%` } },
            ],
        },
    });

    const seedBatch = Date.now();
    let totalAmount = 0;
    const rows = donations.map((d, index) => {
        const amount = Math.max(0, Math.floor(Number(d.amount)) || 0);
        totalAmount += amount;
        const createdAt = d.created_at ? new Date(d.created_at) : new Date(now.getTime() + index * 60_000);
        return {
            largeCrowdfundingPageId: pageId,
            merchantId,
            pageKey,
            donorName: String(d.donorName ?? d.name ?? '匿名').slice(0, 100),
            amount,
            message: d.message ? String(d.message).slice(0, 500) : null,
            paymentTradeNo: `${testTradePrefix}${seedBatch}-${String(index + 1).padStart(3, '0')}`,
            created_at: createdAt,
        };
    });

    if (rows.length > 0) {
        await LargeCrowdfundingDonation.bulkCreate(rows);
    }

    await page.update({
        currentTotal: totalAmount,
        updated_at: now,
    });

    console.log(
        `[seed] 大型募資 ${merchantId}/${pageKey}：` +
            `${rows.length} 筆斗內，currentTotal=${totalAmount}`
    );
}

async function seedLocalTestData() {
    const files = listJsonFixtures(TEST_DATA_DIR);
    if (files.length === 0) {
        console.log('[seed] 無 test-data JSON，略過');
        return;
    }

    for (const file of files) {
        const base = path.basename(file);
        if (base === 'package.json') {
            continue;
        }
        let fixture;
        try {
            fixture = JSON.parse(fs.readFileSync(file, 'utf8'));
        } catch (err) {
            console.error(`[seed] 無法解析 ${base}:`, err.message);
            continue;
        }
        if (base === LCF_FIXTURE || fixture.donations) {
            await seedLargeCrowdfundingFixture(fixture);
        }
    }
}

module.exports = { seedLocalTestData, seedLargeCrowdfundingFixture };
