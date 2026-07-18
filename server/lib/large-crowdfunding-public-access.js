const PageStore = require('../store/large-crowdfunding-page');
const { normalizePageKey } = require('./large-crowdfunding');

/**
 * 公開榜單 API：僅允許已發布且未刪除的 pageKey
 * @param {string} pageKeyRaw
 * @returns {Promise<{ ok: true, pageKey: string }|{ ok: false, status: number, error: string }>}
 */
async function assertPublicDonorPageAccess(pageKeyRaw) {
    const pageKey = normalizePageKey(pageKeyRaw);
    if (!pageKey) {
        return { ok: false, status: 400, error: 'pageKey 無效' };
    }
    const page = await PageStore.findPublishedByPageKey(pageKey);
    if (!page) {
        return { ok: false, status: 404, error: '找不到募資頁面' };
    }
    return { ok: true, pageKey };
}

module.exports = {
    assertPublicDonorPageAccess,
};
