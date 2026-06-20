/**
 * 將舊版手動 migration 登記到 schema_migrations（不執行 SQL）
 *
 * 適用：正式站 schema 已是最新，但尚未導入 Umzug 紀錄表。
 *
 * 用法：
 *   node server/migration/bootstrap-legacy-records.js --dry-run
 *   node server/migration/bootstrap-legacy-records.js
 *
 * 正式站：
 *   NODE_ENV=production node server/migration/bootstrap-legacy-records.js
 */
require('dotenv').config();

const legacyNames = require('./legacy-migration-names');
const { createUmzug, sequelize } = require('./create-umzug');

async function main() {
    const dryRun = process.argv.includes('--dry-run');
    const umzug = createUmzug();

    await umzug.executed();

    const [existingRows] = await sequelize.query(
        `SELECT name FROM schema_migrations`
    );
    const existing = new Set(existingRows.map(r => r.name));

    const toInsert = legacyNames.filter(name => !existing.has(name));

    if (toInsert.length === 0) {
        console.log('[bootstrap] 舊版 migration 紀錄已齊，無需寫入');
        await sequelize.close();
        return;
    }

    console.log(`[bootstrap] 將登記 ${toInsert.length} 筆舊 migration：`);
    toInsert.forEach(name => console.log(`  · ${name}`));

    if (dryRun) {
        console.log('\n[dry-run] 未寫入資料庫');
        await sequelize.close();
        return;
    }

    for (const name of toInsert) {
        await sequelize.query(`INSERT INTO schema_migrations (name) VALUES (:name)`, {
            replacements: { name },
        });
    }

    console.log('[bootstrap] 完成');
    await sequelize.close();
}

main().catch(err => {
    console.error('[bootstrap] 失敗:', err);
    process.exit(1);
});
