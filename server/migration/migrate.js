/**
 * Umzug migration CLI
 *
 * 用法：
 *   node server/migration/migrate.js up
 *   node server/migration/migrate.js status
 *   node server/migration/migrate.js pending
 *   node server/migration/migrate.js executed
 *
 * 正式站：
 *   NODE_ENV=production node server/migration/migrate.js up
 */
require('dotenv').config();

const { createUmzug, sequelize } = require('./create-umzug');

function printUsage() {
    console.log(`
Umzug migration 指令：

  node server/migration/migrate.js up        執行尚未套用的 migration
  node server/migration/migrate.js status    列出已執行 / 待執行
  node server/migration/migrate.js pending   僅列出待執行
  node server/migration/migrate.js executed  僅列出已執行

環境：
  NODE_ENV=production  → 使用 DATABASE_URL
  其他                 → 使用 TEST_DB_URL
`);
}

async function printStatus(umzug) {
    const executed = await umzug.executed();
    const pending = await umzug.pending();

    console.log('--- 已執行 ---');
    if (executed.length === 0) {
        console.log('（無）');
    } else {
        executed.forEach(m => console.log(`  ✓ ${m.name}`));
    }

    console.log('--- 待執行 ---');
    if (pending.length === 0) {
        console.log('（無）');
    } else {
        pending.forEach(m => console.log(`  · ${m.name}`));
    }
}

async function main() {
    const command = (process.argv[2] || 'up').trim().toLowerCase();
    const umzug = createUmzug();

    const dbHint =
        process.env.NODE_ENV === 'production' ? 'DATABASE_URL' : 'TEST_DB_URL';
    console.log(`[migrate] NODE_ENV=${process.env.NODE_ENV || '(未設定)'} → ${dbHint}\n`);

    try {
        switch (command) {
            case 'up': {
                const executed = await umzug.up();
                if (executed.length === 0) {
                    console.log('[migrate] 沒有待執行的 migration');
                } else {
                    console.log('[migrate] 已完成：');
                    executed.forEach(m => console.log(`  ✓ ${m.name}`));
                }
                break;
            }
            case 'status':
                await printStatus(umzug);
                break;
            case 'pending': {
                const pending = await umzug.pending();
                pending.forEach(m => console.log(m.name));
                if (pending.length === 0) {
                    console.log('（無待執行 migration）');
                }
                break;
            }
            case 'executed': {
                const executed = await umzug.executed();
                executed.forEach(m => console.log(m.name));
                if (executed.length === 0) {
                    console.log('（無已執行 migration）');
                }
                break;
            }
            default:
                printUsage();
                process.exitCode = 1;
        }
    } catch (error) {
        console.error('[migrate] 失敗:', error);
        process.exitCode = 1;
    } finally {
        await sequelize.close();
    }
}

main();
