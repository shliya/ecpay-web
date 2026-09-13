const { listAllMemberships } = require('../../store/merchant-member');

/**
 * 列出目前所有的 Google 帳號 ↔ 商店綁定，供管理者決定要解除哪一筆。
 * canRestoreTotp 表示該商店仍留有 totpSecret，解綁後可以還原舊登入方式。
 */
module.exports = async (req, res) => {
    try {
        const memberships = await listAllMemberships();
        res.json({ count: memberships.length, memberships });
    } catch (error) {
        console.error('[admin] 列出綁定失敗:', error);
        res.status(500).json({ error: '伺服器錯誤' });
    }
};
