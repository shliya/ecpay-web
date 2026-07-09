/**
 * GET /api/v1/comme/ecpay/donations/id=:merchantId handler
 */
jest.mock('../../server/service/donation', () => ({
    getDonationsByEcpayConfigId: jest.fn(),
}));

const {
    getDonationsByEcpayConfigId,
} = require('../../server/service/donation');
const handler = require('../../server/route-handlers/comme/handle-get-ecpay-donation');

function createMockRes() {
    const res = {
        statusCode: 200,
        body: null,
    };
    res.status = jest.fn(code => {
        res.statusCode = code;
        return res;
    });
    res.json = jest.fn(payload => {
        res.body = payload;
        return res;
    });
    return res;
}

describe('handle-get-ecpay-donation', () => {
    test('成功回傳斗內列表', async () => {
        const donations = [
            { id: 1, name: 'A', cost: 100, message: '', type: 1 },
        ];
        getDonationsByEcpayConfigId.mockResolvedValue(donations);
        const res = createMockRes();

        await handler({ params: { merchantId: 'M1' } }, res);

        expect(getDonationsByEcpayConfigId).toHaveBeenCalledWith('M1');
        expect(res.body).toEqual(donations);
        expect(res.statusCode).toBe(200);
    });

    test('ENOENT 錯誤回空陣列', async () => {
        const err = new Error('not found');
        err.code = 'ENOENT';
        getDonationsByEcpayConfigId.mockRejectedValue(err);
        const res = createMockRes();

        await handler({ params: { merchantId: 'M1' } }, res);

        expect(res.body).toEqual([]);
        expect(res.statusCode).toBe(200);
    });

    test('其他錯誤回 500 且不洩漏內部訊息', async () => {
        getDonationsByEcpayConfigId.mockRejectedValue(
            new Error('db exploded: secret detail')
        );
        const res = createMockRes();

        await handler({ params: { merchantId: 'M1' } }, res);

        expect(res.statusCode).toBe(500);
        expect(res.body).toEqual({ error: '伺服器錯誤' });
        expect(JSON.stringify(res.body)).not.toContain('secret detail');
    });
});
