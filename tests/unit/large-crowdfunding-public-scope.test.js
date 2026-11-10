/**
 * 大型募資公開頁／榜單：一律以「商店＋pageKey」定位，不分店的查詢不可存在。
 *
 * pageKey 只在同一間店內唯一（unique index 是 ecpayConfigId + pageKey）。
 * 修正前公開連結只帶 ?name=pageKey，後端用 findByPageKey 隨機挑一間，
 * 兩間店都用預設的 default 時，觀眾可能看到別間店的頁面、斗內付錯店，
 * 榜單也會把兩間店的斗內者混在一起。
 */
jest.mock('../../server/store/large-crowdfunding-page', () => ({
    findByEcpayConfigIdAndPageKey: jest.fn(),
}));
jest.mock('../../server/store/large-crowdfunding-donation', () => ({
    DEFAULT_RECENT_LIMIT: 20,
    MAX_PAGE_LIMIT: 100,
    sumAmountByPageId: jest.fn(async () => 0),
    listRecentByPageId: jest.fn(async () => []),
    countByPageId: jest.fn(async () => 0),
    listSpecialDonationsByPageId: jest.fn(async () => []),
}));
jest.mock('../../server/lib/large-crowdfunding-config', () => ({
    resolveEcpayConfigFromMerchantKey: jest.fn(),
    resolveEcpayConfigIdForLcfPayment: jest.fn(),
}));

const fs = require('fs');
const path = require('path');
const PageStore = require('../../server/store/large-crowdfunding-page');
const DonationStore = require('../../server/store/large-crowdfunding-donation');
const {
    resolveEcpayConfigFromMerchantKey,
} = require('../../server/lib/large-crowdfunding-config');
const { LCF_PAGE_STATUS } = require('../../server/lib/large-crowdfunding');
const {
    getPublicPageByPageKey,
} = require('../../server/service/large-crowdfunding-page');
const {
    assertPublicDonorPageAccess,
} = require('../../server/lib/large-crowdfunding-public-access');
const {
    listDonorsPagedForApi,
    listDonorsTenForApi,
    listSpecialDonorsForApi,
} = require('../../server/service/large-crowdfunding-donation');

// 兩間店都有一頁叫 default
const STORES = {
    STORE_A: { ecpayConfigId: 1, merchantId: 'STORE_A' },
    STORE_B: { ecpayConfigId: 2, merchantId: 'STORE_B' },
};
const PAGES = [
    { id: 11, ecpayConfigId: 1, merchantId: 'STORE_A', pageKey: 'default', title: 'A 店募資' },
    { id: 22, ecpayConfigId: 2, merchantId: 'STORE_B', pageKey: 'default', title: 'B 店募資' },
].map(p => ({
    ...p,
    status: LCF_PAGE_STATUS.ACTIVE,
    publishedAt: '2026-01-01T00:00:00.000Z',
    theme: {},
    contentBlocks: [],
    milestones: [],
}));

beforeEach(() => {
    resolveEcpayConfigFromMerchantKey.mockImplementation(
        async mid => STORES[mid] || null
    );
    PageStore.findByEcpayConfigIdAndPageKey.mockImplementation(
        async (cfgId, key) =>
            PAGES.find(p => p.ecpayConfigId === cfgId && p.pageKey === key) ||
            null
    );
});

describe('公開募資頁 getPublicPageByPageKey', () => {
    test('沒帶商店代號一律拒絕，不會隨便挑一間店', async () => {
        await expect(getPublicPageByPageKey('default')).resolves.toEqual({
            status: 'missing_merchant',
        });
        await expect(getPublicPageByPageKey('default', '  ')).resolves.toEqual({
            status: 'missing_merchant',
        });
        expect(PageStore.findByEcpayConfigIdAndPageKey).not.toHaveBeenCalled();
    });

    test('兩間店同名 pageKey：各自只會拿到自己那一頁', async () => {
        const a = await getPublicPageByPageKey('default', 'STORE_A');
        const b = await getPublicPageByPageKey('default', 'STORE_B');
        expect(a.status).toBe('ok');
        expect(b.status).toBe('ok');
        expect(a.data.title).toBe('A 店募資');
        expect(b.data.title).toBe('B 店募資');
        expect(a.data.merchantId).toBe('STORE_A');
        expect(b.data.merchantId).toBe('STORE_B');
    });

    test('累計金額用頁面 id 計算', async () => {
        await getPublicPageByPageKey('default', 'STORE_B');
        expect(DonationStore.sumAmountByPageId).toHaveBeenCalledWith(22);
    });

    test('商店不存在回 not_found', async () => {
        await expect(
            getPublicPageByPageKey('default', 'NOPE')
        ).resolves.toEqual({ status: 'not_found' });
    });
});

describe('公開榜單 assertPublicDonorPageAccess', () => {
    test('沒帶商店代號回 400', async () => {
        await expect(assertPublicDonorPageAccess('', 'default')).resolves.toMatchObject({
            ok: false,
            status: 400,
        });
    });

    test('兩間店同名 pageKey：回傳各自的頁面 id', async () => {
        await expect(
            assertPublicDonorPageAccess('STORE_A', 'default')
        ).resolves.toEqual({ ok: true, pageId: 11, pageKey: 'default' });
        await expect(
            assertPublicDonorPageAccess('STORE_B', 'default')
        ).resolves.toEqual({ ok: true, pageId: 22, pageKey: 'default' });
    });

    test.each([
        ['未發布', { publishedAt: null }],
        ['已刪除', { status: LCF_PAGE_STATUS.DELETED }],
    ])('%s的頁面不公開榜單', async (_label, patch) => {
        PageStore.findByEcpayConfigIdAndPageKey.mockResolvedValue({
            ...PAGES[0],
            ...patch,
        });
        await expect(
            assertPublicDonorPageAccess('STORE_A', 'default')
        ).resolves.toMatchObject({ ok: false, status: 404 });
    });
});

describe('榜單查詢一律用頁面 id', () => {
    test('分頁榜單、榜十、特殊主題榜都以頁面 id 查詢', async () => {
        await listDonorsPagedForApi(22, { page: 1, limit: 10 });
        await listDonorsTenForApi(22);
        await listSpecialDonorsForApi(22);

        expect(DonationStore.listRecentByPageId).toHaveBeenCalledWith(22, expect.any(Object));
        expect(DonationStore.countByPageId).toHaveBeenCalledWith(22);
        expect(DonationStore.listSpecialDonationsByPageId).toHaveBeenCalledWith(22);
    });
});

describe('路由與 SQL 不可再出現「只用 pageKey」的查詢', () => {
    const read = rel =>
        fs.readFileSync(path.join(__dirname, '../../server', rel), 'utf8');

    test('公開頁與榜單路由都帶 id=:merchantId', () => {
        const routes = read('routes/hamster-tools/comme.js');
        const publicRoutes = [
            ...routes.matchAll(/'(\/crowdfunding\/(?:public|donors)\/[^']*)'/g),
        ].map(m => m[1]);

        expect(publicRoutes.length).toBeGreaterThanOrEqual(4);
        for (const r of publicRoutes) {
            expect(r).toMatch(/\/id=:merchantId\/pageKey=:pageKey/);
        }
        expect(routes).not.toMatch(/'\/crowdfunding\/pageKey=:pageKey'/);
    });

    test('榜單 SQL 以 largeCrowdfundingPageId 篩選，不以 pageKey 篩選', () => {
        const sql = read('store/large-crowdfunding-donation.js');
        expect(sql).not.toMatch(/WHERE\s+"pageKey"\s*=/);
        expect(sql).not.toMatch(/where:\s*\{\s*pageKey\s*\}/);
    });
});
