/**
 * 公開大型募資 API 資安：不回傳內部 ecpayConfigId
 */
const {
    pageRowToPublicApiJson,
    LCF_PAGE_STATUS,
} = require('../../server/lib/large-crowdfunding');

describe('pageRowToPublicApiJson', () => {
    const base = {
        id: 2,
        ecpayConfigId: 4,
        pageKey: 'demo',
        merchantId: 'M123',
        title: '測試',
        manuallyClosed: false,
        fundraisingStartsAt: '2020-01-01T00:00:00.000Z',
        fundraisingEndsAt: '2099-01-01T00:00:00.000Z',
        publishedAt: '2020-01-01T00:00:00.000Z',
        status: LCF_PAGE_STATUS.ACTIVE,
        theme: {},
        contentBlocks: [],
        milestones: [],
        currentTotal: 100,
    };

    test('去掉 ecpayConfigId，保留 merchantId／id（贊助入口）', () => {
        const json = pageRowToPublicApiJson(base);
        expect(json.ecpayConfigId).toBeUndefined();
        expect(json.merchantId).toBe('M123');
        expect(json.id).toBe(2);
        expect(json.pageKey).toBe('demo');
    });

    test('已結束仍保留 merchantId／id，供同一贊助入口使用', () => {
        const json = pageRowToPublicApiJson({
            ...base,
            fundraisingEndsAt: '2020-06-01T00:00:00.000Z',
        });
        expect(json.ecpayConfigId).toBeUndefined();
        expect(json.merchantId).toBe('M123');
        expect(json.id).toBe(2);
    });
});
