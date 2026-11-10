const PageStore = require('../store/large-crowdfunding-page');
const { normalizePageKey, isPageActiveStatus } = require('./large-crowdfunding');
const { resolveEcpayConfigFromMerchantKey } = require('./large-crowdfunding-config');

/**
 * 公開榜單 API 的存取檢查：以「商店＋pageKey」找到唯一一頁，
 * 且必須已發布、未刪除。回傳頁面 id，榜單一律用頁面 id 查斗內紀錄，
 * 不會把其他店同名 pageKey 的斗內混進來。
 *
 * @param {string} merchantIdRaw
 * @param {string} pageKeyRaw
 * @returns {Promise<{ ok: true, pageId: number, pageKey: string }|{ ok: false, status: number, error: string }>}
 */
async function assertPublicDonorPageAccess(merchantIdRaw, pageKeyRaw) {
    const pageKey = normalizePageKey(pageKeyRaw);
    if (!pageKey) {
        return { ok: false, status: 400, error: 'pageKey 無效' };
    }

    const merchantId = String(merchantIdRaw || '').trim();
    if (!merchantId) {
        return { ok: false, status: 400, error: '缺少商店代號' };
    }

    const resolved = await resolveEcpayConfigFromMerchantKey(merchantId);
    if (!resolved) {
        return { ok: false, status: 404, error: '找不到募資頁面' };
    }

    const page = await PageStore.findByEcpayConfigIdAndPageKey(
        resolved.ecpayConfigId,
        pageKey
    );
    if (!page || !page.publishedAt || !isPageActiveStatus(page.status)) {
        return { ok: false, status: 404, error: '找不到募資頁面' };
    }

    return { ok: true, pageId: page.id, pageKey };
}

module.exports = {
    assertPublicDonorPageAccess,
};
