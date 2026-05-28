/**
 * 唯讀檢查正式站 schema（不修改資料）
 * 執行：node server/migration/_inspect-schema-readonly.js
 */
require('dotenv').config();
const { Sequelize } = require('sequelize');

const url = process.env.DATABASE_URL;
if (!url) {
    console.error('DATABASE_URL 未設定');
    process.exit(1);
}

const seq = new Sequelize(url, {
    dialect: 'postgres',
    logging: false,
    dialectOptions: {
        ssl: { require: true, rejectUnauthorized: false },
    },
});

const TABLES = [
    'large_crowdfunding_pages',
    'large_crowdfunding_donations',
    'payment_pending_orders',
    'ecpay_config',
    'donations',
];

const ECPAY_CONFIG_COLS = [
    'opayMerchantId',
    'opayHashKey',
    'opayHashIV',
    'opayEnabled',
    'payuniMerchantId',
    'payuniHashKey',
    'payuniHashIV',
    'payuniEnabled',
    'ecpayEnabled',
    'largeCrowdfundingEnabled',
    'youtubeDonationEnabled',
];

const LCF_PAGES_COLS = [
    'ecpayConfigId',
    'status',
    'mainDonorListTitle',
    'specialThemeRankingTitle',
    'specialThemeTierIconUrl',
    'specialThemeTierIcons',
    'periodLabel',
    'logoImageUrl',
];

const LCF_DONATIONS_COLS = ['ecpayConfigId', 'payment_trade_no'];

async function existingTables(names) {
    const [rows] = await seq.query(
        `
        SELECT table_name
        FROM information_schema.tables
        WHERE table_schema = 'public'
        `
    );
    const set = new Set(rows.map(r => r.table_name));
    return new Set(names.filter(n => set.has(n)));
}

async function existingColumns(table, names) {
    const [rows] = await seq.query(
        `
        SELECT column_name
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = :table
        `,
        { replacements: { table } }
    );
    const set = new Set(rows.map(r => r.column_name));
    return new Set(names.filter(n => set.has(n)));
}

function printCols(label, expected, have) {
    console.log(`\n=== ${label} ===`);
    for (const c of expected) {
        console.log(have.has(c) ? '[OK]' : '[--]', c);
    }
}

(async () => {
    await seq.authenticate();
    const host = new URL(
        url.replace(/^postgres:\/\//, 'postgresql://')
    ).hostname;
    console.log('Connected (read-only), host:', host);

    const tables = await existingTables(TABLES);
    console.log('\n=== TABLES ===');
    for (const t of TABLES) {
        console.log(tables.has(t) ? '[OK]' : '[--]', t);
    }

    if (tables.has('ecpay_config')) {
        printCols(
            'ecpay_config',
            ECPAY_CONFIG_COLS,
            await existingColumns('ecpay_config', ECPAY_CONFIG_COLS)
        );
    }

    if (tables.has('large_crowdfunding_pages')) {
        printCols(
            'large_crowdfunding_pages',
            LCF_PAGES_COLS,
            await existingColumns(
                'large_crowdfunding_pages',
                LCF_PAGES_COLS
            )
        );
        const [[{ n }]] = await seq.query(
            'SELECT COUNT(*)::int AS n FROM large_crowdfunding_pages'
        );
        console.log('large_crowdfunding_pages rows:', n);
    }

    if (tables.has('large_crowdfunding_donations')) {
        printCols(
            'large_crowdfunding_donations',
            LCF_DONATIONS_COLS,
            await existingColumns(
                'large_crowdfunding_donations',
                LCF_DONATIONS_COLS
            )
        );
        const [[{ n }]] = await seq.query(
            'SELECT COUNT(*)::int AS n FROM large_crowdfunding_donations'
        );
        console.log('large_crowdfunding_donations rows:', n);
    }

    if (tables.has('payment_pending_orders')) {
        const [[{ n }]] = await seq.query(
            'SELECT COUNT(*)::int AS n FROM payment_pending_orders'
        );
        console.log('\npayment_pending_orders rows:', n);
    }

    if (tables.has('donations')) {
        const have = await existingColumns('donations', ['ecpayConfigId']);
        console.log(
            '\ndonations.ecpayConfigId:',
            have.has('ecpayConfigId') ? 'OK' : 'MISSING'
        );
    }

    console.log('\n--- MIGRATION HINT (missing only) ---');
    const hints = [];
    if (!tables.has('payment_pending_orders')) {
        hints.push('createPaymentPendingOrdersTable.js');
    }
    if (!tables.has('large_crowdfunding_pages')) {
        hints.push('createLargeCrowdfundingTables.js (+ LCF chain)');
    } else {
        const pCols = await existingColumns(
            'large_crowdfunding_pages',
            LCF_PAGES_COLS
        );
        if (!pCols.has('ecpayConfigId')) {
            hints.push('addEcpayConfigIdToLargeCrowdfunding.js');
        }
        if (!pCols.has('status')) {
            hints.push('addStatusToLargeCrowdfundingPages.js');
        }
        if (!pCols.has('mainDonorListTitle')) {
            hints.push('addLeaderboardTitlesToLargeCrowdfundingPages.js');
        }
        if (pCols.has('specialThemeTierIcons') && !pCols.has('specialThemeTierIconUrl')) {
            hints.push('specialThemeTierIconUrlColumn.js (maybe adjustLargeCrowdfundingPageVisualFields.js first)');
        }
        if (!pCols.has('specialThemeTierIconUrl') && !pCols.has('specialThemeTierIcons')) {
            hints.push('specialThemeTierIconUrlColumn.js or recreate via latest createLargeCrowdfundingTables');
        }
    }
    if (tables.has('large_crowdfunding_donations')) {
        const dCols = await existingColumns(
            'large_crowdfunding_donations',
            LCF_DONATIONS_COLS
        );
        if (!dCols.has('payment_trade_no')) {
            hints.push('addPaymentTradeNoToLargeCrowdfundingDonations.js');
        }
        if (!dCols.has('ecpayConfigId')) {
            hints.push('addEcpayConfigIdToLargeCrowdfunding.js');
        }
    }
    const eCols = tables.has('ecpay_config')
        ? await existingColumns('ecpay_config', ECPAY_CONFIG_COLS)
        : new Set();
    if (!eCols.has('largeCrowdfundingEnabled')) {
        hints.push('addLargeCrowdfundingEnabledToEcpayConfig.js');
    }
    if (!eCols.has('opayMerchantId')) {
        hints.push('addOpayColumnsToEcpayConfig.js');
    }
    if (hints.length === 0) {
        console.log('(core columns present — optional legacy migrations may still be skippable)');
    } else {
        hints.forEach(h => console.log('-', h));
    }

    await seq.close();
})().catch(err => {
    console.error('Inspect failed:', err.message);
    process.exit(1);
});
