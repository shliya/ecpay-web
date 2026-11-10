/**
 * 商店代號跨欄位唯一：同一個字串在全站只能出現在
 * 綠界 merchantId／payuniMerchantId／opayMerchantId 其中一格。
 *
 * 否則 A 店把 payuniMerchantId 設成 B 店的綠界代號後，
 * 依序比對三個欄位的 getEcpayConfigByMerchantId 會把兩間店混在一起。
 */
jest.mock('../../server/store/ecpay-config', () => ({
    findConfigsUsingIdentifier: jest.fn(),
    getEcpayConfigByMerchantId: jest.fn(),
    updateEcpayConfig: jest.fn(),
    createEcpayConfig: jest.fn(),
    getTransaction: jest.fn(),
}));

const store = require('../../server/store/ecpay-config');
const {
    updateEcpayConfig,
    createEcpayConfig,
    createPayuniConfig,
} = require('../../server/service/ecpay-config');
const { ECPAY_CONFIG_DUPLICATE_CODE } = require('../../server/lib/error/code');

// 全站現有的兩間店
const STORES = [
    { id: 1, merchantId: 'ATTACKER', payuniMerchantId: null, opayMerchantId: null },
    { id: 2, merchantId: 'VICTIM', payuniMerchantId: 'VICTIM_PU', opayMerchantId: 'VICTIM_OP' },
];

let txn;

beforeEach(() => {
    store.findConfigsUsingIdentifier.mockImplementation(async value =>
        STORES.filter(
            s =>
                s.merchantId === value ||
                s.payuniMerchantId === value ||
                s.opayMerchantId === value
        ).map(s => ({ id: s.id }))
    );
    store.getEcpayConfigByMerchantId.mockImplementation(
        async id => STORES.find(s => s.merchantId === id) || null
    );
    store.updateEcpayConfig.mockImplementation(async (id, data) => ({
        merchantId: id,
        ...data,
    }));
    txn = { commit: jest.fn(), rollback: jest.fn() };
    store.getTransaction.mockResolvedValue(txn);
    store.createEcpayConfig.mockImplementation(async row => ({ id: 99, ...row }));
});

describe('更新設定（PATCH /comme/ecpay/config）', () => {
    test.each([
        ['B 店的綠界代號', 'payuniMerchantId', 'VICTIM'],
        ['B 店的 PayUni 代號', 'opayMerchantId', 'VICTIM_PU'],
        ['B 店的 OPay 代號', 'payuniMerchantId', 'VICTIM_OP'],
        ['前後帶空白的 B 店代號', 'payuniMerchantId', '  VICTIM  '],
    ])('A 店不能把 %s 設成自己的代號', async (_label, field, value) => {
        await expect(
            updateEcpayConfig('ATTACKER', { [field]: value })
        ).rejects.toThrow(ECPAY_CONFIG_DUPLICATE_CODE.message);
        expect(store.updateEcpayConfig).not.toHaveBeenCalled();
    });

    test('沒人用過的代號可以設定，且會去掉前後空白', async () => {
        await updateEcpayConfig('ATTACKER', { payuniMerchantId: ' NEW_PU ' });
        expect(store.updateEcpayConfig).toHaveBeenCalledWith('ATTACKER', {
            payuniMerchantId: 'NEW_PU',
        });
    });

    test('B 店重新儲存自己原本的代號不算撞名', async () => {
        await updateEcpayConfig('VICTIM', {
            payuniMerchantId: 'VICTIM_PU',
            opayMerchantId: 'VICTIM_OP',
        });
        expect(store.updateEcpayConfig).toHaveBeenCalled();
    });

    test('沒有改代號的更新不會多查資料庫', async () => {
        await updateEcpayConfig('ATTACKER', { displayName: '新名字' });
        expect(store.findConfigsUsingIdentifier).not.toHaveBeenCalled();
    });
});

describe('建立商店', () => {
    test('新商店的綠界代號不能是別店的 PayUni 代號', async () => {
        await expect(
            createEcpayConfig({ merchantId: 'VICTIM_PU', hashKey: 'k', hashIV: 'v' })
        ).rejects.toThrow(ECPAY_CONFIG_DUPLICATE_CODE.message);
        expect(store.createEcpayConfig).not.toHaveBeenCalled();
    });

    test('新 PayUni 商店的代號不能是別店的綠界代號', async () => {
        await expect(
            createPayuniConfig({
                payuniMerchantId: 'VICTIM',
                payuniHashKey: 'k',
                payuniHashIV: 'v',
            })
        ).rejects.toThrow(ECPAY_CONFIG_DUPLICATE_CODE.message);
    });

    test('資料庫 unique 衝突時會 rollback，不會佔住連線', async () => {
        const err = new Error('dup');
        err.name = 'SequelizeUniqueConstraintError';
        store.createEcpayConfig.mockRejectedValue(err);

        await expect(
            createEcpayConfig({ merchantId: 'BRAND_NEW', hashKey: 'k', hashIV: 'v' })
        ).rejects.toThrow(ECPAY_CONFIG_DUPLICATE_CODE.message);
        expect(txn.rollback).toHaveBeenCalledTimes(1);
    });
});
