const { getAuthSession } = require('../../lib/auth-session');
const { getMembershipsByUserId } = require('../../store/merchant-member');

/**
 * 回傳目前 Google 登入者的身分與已綁定的商店。
 * 前端登入頁靠這支決定要導向後台、還是要先完成綁定。
 */
module.exports = async (req, res) => {
    try {
        const session = await getAuthSession(req);
        if (!session) {
            res.status(401).json({ error: '尚未登入' });
            return;
        }

        const merchants = await getMembershipsByUserId(session.user.id);

        res.json({
            user: {
                id: session.user.id,
                email: session.user.email,
                name: session.user.name,
                image: session.user.image || null,
            },
            merchants,
        });
    } catch (error) {
        console.error('[me] 取得身分失敗:', error);
        res.status(500).json({ error: '伺服器錯誤' });
    }
};
